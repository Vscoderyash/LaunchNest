// Deployment creation.
// IMPLEMENTED: state machine, history, ownership checks, plan limits.
// MOCKED: the actual "build" — for a STATIC project this just validates and
//   marks files ready instantly. There is no isolated build container here.
// FUTURE: real build workers (Docker), S3 artifact storage, subdomain routing
//   at the edge — see /docs/architecture.md for the intended production design.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLimitsForTier } from "@/lib/limits";

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

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const limits = getLimitsForTier(user!.planTier);

  const deploymentCount = await prisma.deployment.count({ where: { projectId: project.id } });
  if (deploymentCount >= limits.maxDeploymentsPerProject) {
    return NextResponse.json(
      { error: `Deployment history limit reached (${limits.maxDeploymentsPerProject}). Older deployments must be cleared first.` },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const isTemporary: boolean = body?.isTemporary ?? false;
  const temporaryHours: number = body?.temporaryHours === 168 ? 168 : 24; // 7 days or 24h

  const lastVersion = await prisma.deployment.findFirst({
    where: { projectId: project.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const filesCount = await prisma.projectFile.count({ where: { projectId: project.id } });
  if (filesCount === 0) {
    return NextResponse.json(
      { error: "This project has no files yet. Upload a ZIP or use the editor before deploying." },
      { status: 400 }
    );
  }

  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      version,
      status: "QUEUED",
      source: "EDITOR",
      isProduction: !isTemporary,
      isTemporary,
      expiresAt: isTemporary
        ? new Date(Date.now() + temporaryHours * 60 * 60 * 1000)
        : null,
    },
  });

  // MOCKED build: instant "build" for static files, with a synthetic log
  // trail so the deployment detail page has something real to render.
  await prisma.deploymentLog.createMany({
    data: [
      { deploymentId: deployment.id, message: "Deployment queued", level: "info" },
      { deploymentId: deployment.id, message: "Starting build", level: "info" },
      { deploymentId: deployment.id, message: `Detected framework: ${project.framework}`, level: "info" },
      { deploymentId: deployment.id, message: "Validating files", level: "info" },
      { deploymentId: deployment.id, message: "Publishing static assets", level: "info" },
      { deploymentId: deployment.id, message: "Deployment ready", level: "info" },
    ],
  });

  const finished = await prisma.deployment.update({
    where: { id: deployment.id },
    data: {
      status: "READY",
      buildStartedAt: new Date(),
      buildFinishedAt: new Date(),
      buildDurationMs: 400 + Math.floor(Math.random() * 600),
      storageKey: `local://projects/${project.id}/deployments/${deployment.id}`,
    },
  });

  if (!isTemporary) {
    // New production deployment supersedes the previous one for hostname routing.
    await prisma.deployment.updateMany({
      where: { projectId: project.id, isProduction: true, NOT: { id: deployment.id } },
      data: { isProduction: false },
    });
  }

  const hostname = `${project.slug}.launchnest.app`;
  await prisma.domain.upsert({
    where: { hostname },
    update: {},
    create: { projectId: project.id, hostname, isPrimary: true },
  });

  return NextResponse.json({ deployment: finished, url: `https://${hostname}` }, { status: 201 });
}
