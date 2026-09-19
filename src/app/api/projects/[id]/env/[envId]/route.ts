// IMPLEMENTED
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, envId } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const variable = await prisma.environmentVariable.findUnique({ where: { id: envId } });
  if (!variable || variable.projectId !== project.id) {
    return NextResponse.json({ error: "Environment variable not found" }, { status: 404 });
  }

  await prisma.environmentVariable.delete({ where: { id: envId } });
  return NextResponse.json({ success: true });
}
