// IMPLEMENTED
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { projectsCol, projectFilesCol, templatesCol } from "@/lib/firestore";

const ApplySchema = z.object({ templateId: z.string().min(1) });

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
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const templateSnap = await templatesCol().doc(parsed.data.templateId).get();
  if (!templateSnap.exists) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const template = templateSnap.data()!;
  const filesJson = template.filesJson as Record<string, string>;

  const filesRef = projectFilesCol(id);
  const existing = await filesRef.get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  const now = new Date().toISOString();
  const entries = Object.entries(filesJson);
  await Promise.all(
    entries.map(([path, content]) =>
      filesRef.add({ path, content, size: Buffer.byteLength(content, "utf-8"), updatedAt: now })
    )
  );

  await projectsCol().doc(id).update({ framework: template.framework, updatedAt: now });

  return NextResponse.json({ fileCount: entries.length });
}
