// IMPLEMENTED
// Accepts a ZIP upload for a project, replacing its current files.
// MOCKED: file bytes are stored inline in Postgres (ProjectFile.content) for
// text files; binary assets are recorded as metadata only. FUTURE: S3.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLimitsForTier } from "@/lib/limits";
import { extractZip, ZipValidationError, MAX_ZIP_BYTES } from "@/lib/zip";

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

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("zip");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No ZIP file was uploaded." }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `ZIP file is too large (max ${MAX_ZIP_BYTES / 1024 / 1024} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted;
  try {
    extracted = extractZip(buffer);
  } catch (err) {
    if (err instanceof ZipValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to read ZIP file." }, { status: 400 });
  }

  // Enforce free-plan storage limit across all of the user's projects
  // (spec section 20) — approximate: existing stored bytes minus this
  // project's current files, plus the new upload's total size.
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const limits = getLimitsForTier(user!.planTier);

  const [otherProjectsSize, thisProjectCurrentSize] = await Promise.all([
    prisma.projectFile.aggregate({
      where: { project: { ownerId: user!.id, id: { not: project.id } } },
      _sum: { size: true },
    }),
    prisma.projectFile.aggregate({
      where: { projectId: project.id },
      _sum: { size: true },
    }),
  ]);

  const newTotalBytes = extracted.files.reduce((sum, f) => sum + f.size, 0);
  const otherBytes = otherProjectsSize._sum.size ?? 0;
  void thisProjectCurrentSize; // being fully replaced, so not added back in

  const projectedMb = (otherBytes + newTotalBytes) / (1024 * 1024);
  if (projectedMb > limits.maxStorageMb) {
    return NextResponse.json(
      {
        error: `This upload would exceed your ${user!.planTier.toLowerCase()} plan storage limit (${limits.maxStorageMb} MB).`,
      },
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
    prisma.project.update({
      where: { id: project.id },
      data: { framework: extracted.framework },
    }),
  ]);

  return NextResponse.json({
    fileCount: extracted.files.length,
    framework: extracted.framework,
    warnings: extracted.warnings,
  });
}
