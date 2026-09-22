// IMPLEMENTED
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { projectsCol, deploymentsCol, ProjectDoc } from "@/lib/firestore";

async function requireOwnedProject(projectId: string, uid: string) {
  const snap = await projectsCol().doc(projectId).get();
  if (!snap.exists) return { project: null, status: 404 as const };
  const data = snap.data() as ProjectDoc;
  if (data.deletedAt) return { project: null, status: 404 as const };
  if (data.ownerId !== uid) return { project: null, status: 403 as const };
  return { project: { id: snap.id, ...data }, status: 200 as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.uid);
  if (!project) {
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
  }

  const deploymentsSnap = await deploymentsCol(project.id).orderBy("version", "desc").get();
  const deployments = deploymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ project, deployments });
}

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.uid);
  if (!project) {
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await projectsCol()
    .doc(project.id)
    .update({ ...parsed.data, updatedAt: new Date().toISOString() });

  const updated = await projectsCol().doc(project.id).get();
  return NextResponse.json({ project: { id: updated.id, ...updated.data() } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.uid);
  if (!project) {
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
  }

  // Soft delete: keeps history/logs intact. The projectSlugs doc is left in
  // place deliberately — freeing it for reuse needs a cleanup job, same
  // caveat the old Prisma version had with its unique constraint window.
  await projectsCol().doc(project.id).update({ deletedAt: new Date().toISOString() });
  return NextResponse.json({ success: true });
}
