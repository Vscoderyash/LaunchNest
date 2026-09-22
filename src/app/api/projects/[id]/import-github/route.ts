// IMPLEMENTED
// Downloads repo@branch as a zipball and runs it through the same
// extractZip() pipeline as manual ZIP upload.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getUser, projectsCol, projectFilesCol, githubConnectionsCol } from "@/lib/firestore";
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectSnap = await projectsCol().doc(id).get();
  if (!projectSnap.exists || projectSnap.data()!.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (projectSnap.data()!.ownerId !== session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const connSnap = await githubConnectionsCol().doc(session.uid).get();
  if (!connSnap.exists) {
    return NextResponse.json({ error: "GitHub isn't connected yet." }, { status: 400 });
  }

  const { repoFullName, branch } = parsed.data;

  let buffer: Buffer;
  try {
    const token = decryptSecret(connSnap.data()!.encryptedAccessToken);
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

  const user = await getUser(session.uid);
  const limits = getLimitsForTier(user!.planTier);
  const otherProjectsSnap = await projectsCol()
    .where("ownerId", "==", session.uid)
    .where("deletedAt", "==", null)
    .get();
  let otherBytes = 0;
  for (const doc of otherProjectsSnap.docs) {
    if (doc.id === id) continue;
    const filesSnap = await projectFilesCol(doc.id).get();
    otherBytes += filesSnap.docs.reduce((sum, f) => sum + (f.data().size ?? 0), 0);
  }
  const newTotalBytes = extracted.files.reduce((sum, f) => sum + f.size, 0);
  const projectedMb = (otherBytes + newTotalBytes) / (1024 * 1024);
  if (projectedMb > limits.maxStorageMb) {
    return NextResponse.json(
      { error: `This would exceed your ${user!.planTier.toLowerCase()} plan storage limit (${limits.maxStorageMb} MB).` },
      { status: 413 }
    );
  }

  const filesRef = projectFilesCol(id);
  const existing = await filesRef.get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  const now = new Date().toISOString();
  await Promise.all(
    extracted.files.map((f) =>
      filesRef.add({ path: f.path, content: f.content, size: f.size, updatedAt: now })
    )
  );
  await projectsCol().doc(id).update({
    framework: extracted.framework,
    updatedAt: now,
    githubImport: { repoFullName, branch },
  });

  return NextResponse.json({
    fileCount: extracted.files.length,
    framework: extracted.framework,
    warnings: extracted.warnings,
  });
}
