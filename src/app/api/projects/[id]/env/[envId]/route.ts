// IMPLEMENTED
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { projectsCol, envVarsCol } from "@/lib/firestore";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, envId } = await params;
  const projectSnap = await projectsCol().doc(id).get();
  if (!projectSnap.exists || projectSnap.data()!.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (projectSnap.data()!.ownerId !== session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const varRef = envVarsCol(id).doc(envId);
  const varSnap = await varRef.get();
  if (!varSnap.exists) {
    return NextResponse.json({ error: "Environment variable not found" }, { status: 404 });
  }

  await varRef.delete();
  return NextResponse.json({ success: true });
}
