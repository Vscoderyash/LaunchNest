// IMPLEMENTED
// Downloads repo@branch as a zipball and runs it through the same
// extractZip() pipeline as manual ZIP upload (GitHub's zipball wraps
// everything in a single root folder, which extractZip already strips).
// Same MVP limitation as ZIP upload: requires index.html at the repo root,
// so this only works for static sites, not React/Vite/Next.js source repos
// that need a build step (see README).

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { downloadGitHubZipball, GitHubApiError } from "@/lib/github";
import { extractZip, ZipValidationError } from "@/lib/zip";
import { getLimitsForTier } from "@/lib/limits";

const ImportSchema = z.object({
  repoFullName: z.string().min(3),
  branch: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const connection = await prisma.gitHubConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) {
    return NextResponse.json({ error: "GitHub isn't connected yet." }, { status: 400 });
  }

  const { repoFullName, branch } = parsed.data;

  let buffer: Buffer;
  try {
    const token = decryptSecret(connection.encryptedAccessToken);
    buffer = await downloadGitHubZipball(token, repoFullName, branch);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof GitHubApiError ? err.message : "Failed to download repository." },
      { status: 502 }
    );
  }

  let extracted;
  try {
    extracted = extractZip(buffer);
  } catch (err) {
    if (err instanceof ZipValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to process repository contents." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const limits = getLimitsForTier(user!.planTier);
  const [otherProjectsSize] = await Promise.all([
    prisma.projectFile.aggregate({
      where: { project: { ownerId: user!.id, id: { not: project.id } } },
      _sum: { size: true },
    }),
  ]);
  const newTotalBytes = extracted.files.reduce((sum, f) => sum + f.size, 0);
  const projectedMb = ((otherProjectsSize._sum.size ?? 0) + newTotalBytes) / (1024 * 1024);
  if (projectedMb > limits.maxStorageMb) {
    return NextResponse.json(
      { error: `This would exceed your ${user!.planTier.toLowerCase()} plan storage limit (${limits.maxStorageMb} MB).` },
      { status: 413 }
    );
  }

  await prisma.$transaction([
    prisma.projectFile.deleteMany({ where: { projectId: project.id } }),
    prisma.projectFile.createMany({
      data: extracted.files.map((f) => ({
        projectId: project.id,
        path: f.path,
        content: f.content,
        size: f.size,
      })),
    }),
    prisma.project.update({ where: { id: project.id }, data: { framework: extracted.framework } }),
    prisma.gitHubImport.upsert({
      where: { projectId: project.id },
      update: { connectionId: connection.id, repoFullName, branch },
      create: { projectId: project.id, connectionId: connection.id, repoFullName, branch },
    }),
  ]);

  return NextResponse.json({
    fileCount: extracted.files.length,
    framework: extracted.framework,
    warnings: extracted.warnings,
  });
}
