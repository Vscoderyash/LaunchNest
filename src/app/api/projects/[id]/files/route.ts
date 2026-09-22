// IMPLEMENTED
// Backs the simple textarea-based editor (spec section 13).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { projectsCol, projectFilesCol } from "@/lib/firestore";
import { isSafeProjectFilePath } from "@/lib/slug";
import { MAX_FIRESTORE_TEXT_BYTES } from "@/lib/zip";

async function requireOwnedProject(projectId: string, uid: string) {
  const snap = await projectsCol().doc(projectId).get();
  if (!snap.exists || snap.data()!.deletedAt) return { ok: false, status: 404 as const };
  if (snap.data()!.ownerId !== uid) return { ok: false, status: 403 as const };
  return { ok: true, status: 200 as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const check = await requireOwnedProject(id, session.uid);
  if (!check.ok) {
    return NextResponse.json({ error: check.status === 404 ? "Project not found" : "Forbidden" }, { status: check.status });
  }

  const snap = await projectFilesCol(id).orderBy("path", "asc").get();
  const files = snap.docs.map((d) => ({
    path: d.data().path,
    content: d.data().content,
    size: d.data().size,
    updatedAt: d.data().updatedAt,
  }));
  return NextResponse.json({ files });
}

const UpsertSchema = z.object({
  path: z.string().min(1).max(255),
  content: z.string(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const check = await requireOwnedProject(id, session.uid);
  if (!check.ok) {
    return NextResponse.json({ error: check.status === 404 ? "Project not found" : "Forbidden" }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { path, content } = parsed.data;
  if (!isSafeProjectFilePath(path)) {
    return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
  }

  const size = Buffer.byteLength(content, "utf-8");
  if (size > MAX_FIRESTORE_TEXT_BYTES) {
    return NextResponse.json(
      { error: `File is too large (${(size / 1024).toFixed(0)} KB, max ${MAX_FIRESTORE_TEXT_BYTES / 1024} KB per file).` },
      { status: 413 }
    );
  }

  const col = projectFilesCol(id);
  const existing = await col.where("path", "==", path).limit(1).get();
  const now = new Date().toISOString();

  if (!existing.empty) {
    await existing.docs[0].ref.update({ content, size, updatedAt: now });
  } else {
    await col.add({ path, content, size, updatedAt: now });
  }

  return NextResponse.json({ file: { path, updatedAt: now } });
}
