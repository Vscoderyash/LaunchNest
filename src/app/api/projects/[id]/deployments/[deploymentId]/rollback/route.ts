// IMPLEMENTED (spec section 7: "Allow rollback to a previous successful deployment")
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, deploymentId } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.deployment.findUnique({ where: { id: deploymentId } });
  if (!target || target.projectId !== project.id) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }
  if (target.status !== "READY") {
    return NextResponse.json(
      { error: `Can only roll back to a READY deployment (this one is ${target.status}).` },
      { status: 400 }
    );
  }
  if (target.isProduction) {
    return NextResponse.json({ error: "This deployment is already in production." }, { status: 400 });
  }

  const [, promoted] = await prisma.$transaction([
    prisma.deployment.updateMany({
      where: { projectId: project.id, isProduction: true },
      data: { isProduction: false },
    }),
    prisma.deployment.update({
      where: { id: target.id },
      data: { isProduction: true, isTemporary: false, expiresAt: null },
    }),
  ]);

  await prisma.deploymentLog.create({
    data: {
      deploymentId: target.id,
      message: `Rolled back to v${target.version} from the dashboard`,
      level: "info",
    },
  });

  return NextResponse.json({ deployment: promoted });
}
