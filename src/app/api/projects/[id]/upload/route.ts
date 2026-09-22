// IMPLEMENTED
// Accepts a ZIP upload for a project, replacing its current files.
// MOCKED: file bytes are stored inline in Firestore (ProjectFile.content) for
// text files; binary assets are recorded as metadata only. FUTURE: S3/Firebase Storage.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUser, projectsCol, projectFilesCol } from "@/lib/firestore";
import { getLimitsForTier } from "@/lib/limits";
import { extractZip, ZipValidationError, MAX_ZIP_BYTES } from "@/lib/zip";

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

  // Enforce free-plan storage limit. Firestore has no cross-collection SUM
  // aggregate, so this walks each of the user's other projects' file sizes —
  // fine at this scale, would need a maintained counter field at real scale.
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
      { error: `This upload would exceed your ${user!.planTier.toLowerCase()} plan storage limit (${limits.maxStorageMb} MB).` },
      { status: 413 }
    );
  }

  const filesRef = projectFilesCol(id);
  const existing = await filesRef.get();
  const batchDelete = existing.docs.map((d) => d.ref.delete());
  await Promise.all(batchDelete);

  const now = new Date().toISOString();
  await Promise.all(
    extracted.files.map((f) =>
      filesRef.add({ path: f.path, content: f.content, size: f.size, updatedAt: now })
    )
  );
  await projectsCol().doc(id).update({ framework: extracted.framework, updatedAt: now });

  return NextResponse.json({
    fileCount: extracted.files.length,
    framework: extracted.framework,
    warnings: extracted.warnings,
  });
}
