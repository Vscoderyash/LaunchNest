// IMPLEMENTED
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireOwnedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) return { project: null, status: 404 as const };
  if (project.ownerId !== userId) return { project: null, status: 403 as const };
  return { project, status: 200 as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json(
      { error: status === 404 ? "Project not found" : "Forbidden" },
      { status }
    );
  }

  const deployments = await prisma.deployment.findMany({
    where: { projectId: project.id },
    orderBy: { version: "desc" },
  });

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json(
      { error: status === 404 ? "Project not found" : "Forbidden" },
      { status }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: parsed.data,
  });

  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json(
      { error: status === 404 ? "Project not found" : "Forbidden" },
      { status }
    );
  }

  // Soft delete: keeps history/logs intact and immediately frees the slug's
  // *listing*, while the unique slug constraint still protects against an
  // active collision until a cleanup job hard-deletes it later.
  await prisma.project.update({
    where: { id: project.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
