// IMPLEMENTED
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ApplySchema = z.object({ templateId: z.string().min(1) });

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

  const body = await req.json().catch(() => null);
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const template = await prisma.template.findUnique({ where: { id: parsed.data.templateId } });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const filesJson = template.filesJson as Record<string, string>;
  const files = Object.entries(filesJson).map(([path, content]) => ({
    projectId: project.id,
    path,
    content,
    size: Buffer.byteLength(content, "utf-8"),
  }));

  await prisma.$transaction([
    prisma.projectFile.deleteMany({ where: { projectId: project.id } }),
    prisma.projectFile.createMany({ data: files }),
    prisma.project.update({ where: { id: project.id }, data: { framework: template.framework } }),
  ]);

  return NextResponse.json({ fileCount: files.length });
}
