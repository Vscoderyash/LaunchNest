// IMPLEMENTED
// Backs the simple textarea-based editor (spec section 13). Only text files
// are readable/writable here — binary assets uploaded via ZIP still show as
// metadata-only (see README).

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSafeProjectFilePath } from "@/lib/slug";

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
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
  }

  const files = await prisma.projectFile.findMany({
    where: { projectId: project.id },
    select: { path: true, content: true, size: true, updatedAt: true },
    orderBy: { path: "asc" },
  });
  return NextResponse.json({ files });
}

const UpsertSchema = z.object({
  path: z.string().min(1).max(255),
  content: z.string().max(1_000_000), // 1 MB per text file, generous for an MVP editor
});

export async function PUT(
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
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
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

  const file = await prisma.projectFile.upsert({
    where: { projectId_path: { projectId: project.id, path } },
    update: { content, size: Buffer.byteLength(content, "utf-8") },
    create: { projectId: project.id, path, content, size: Buffer.byteLength(content, "utf-8") },
    select: { path: true, updatedAt: true },
  });

  return NextResponse.json({ file });
}
