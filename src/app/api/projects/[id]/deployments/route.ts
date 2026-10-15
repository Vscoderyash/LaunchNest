// Deployment creation.
// IMPLEMENTED: state machine, history, ownership checks, plan limits.
// MOCKED: the actual "build" — for a STATIC project this just validates and
//   marks files ready instantly. There is no isolated build container here.
// FUTURE: real build workers (Docker), S3 artifact storage, edge subdomain
//   routing — see README for the intended production design.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getUser,
  projectsCol,
  projectFilesCol,
  deploymentFilesCol,
  deploymentsCol,
  deploymentLogsCol,
  domainsCol,
} from "@/lib/firestore";
import { getLimitsForTier } from "@/lib/limits";

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
  const project = { id: projectSnap.id, ...projectSnap.data() } as {
    id: string;
    slug: string;
    ownerId: string;
    framework: string;
  };
  if (project.ownerId !== session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getUser(session.uid);
  const limits = getLimitsForTier(user!.planTier);

  const countSnap = await deploymentsCol(project.id).count().get();
  if (countSnap.data().count >= limits.maxDeploymentsPerProject) {
    return NextResponse.json(
      { error: `Deployment history limit reached (${limits.maxDeploymentsPerProject}). Older deployments must be cleared first.` },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const isTemporary: boolean = body?.isTemporary ?? false;
  const temporaryHours: number = body?.temporaryHours === 168 ? 168 : 24; // 7 days or 24h

  const lastVersionSnap = await deploymentsCol(project.id).orderBy("version", "desc").limit(1).get();
  const version = (lastVersionSnap.docs[0]?.data().version ?? 0) + 1;

  const workingFilesSnap = await projectFilesCol(project.id).get();
  if (workingFilesSnap.empty) {
    return NextResponse.json(
      { error: "This project has no files yet. Upload a ZIP or use the editor before deploying." },
      { status: 400 }
    );
  }

  const now = new Date();
  const deploymentRef = deploymentsCol(project.id).doc();

  // Snapshot the files this deployment is made of, so the live site only
  // changes when you deploy, and rollback / temporary-expiry fallback serve
  // exactly what was deployed (not whatever the editor currently holds).
  const snapCol = deploymentFilesCol(project.id, deploymentRef.id);
  await Promise.all(
    workingFilesSnap.docs.map((f) => {
      const { path, content, size } = f.data();
      return snapCol.add({ path, content, size });
    })
  );

  await deploymentRef.set({
    version,
    status: "READY", // MOCKED build completes synchronously — see file header
    source: "EDITOR",
    // A temporary deployment takes over production until it expires; the site
    // then falls back to the latest permanent deployment (see src/lib/deployments.ts).
    isProduction: true,
    snapshot: true,
    fileCount: workingFilesSnap.size,
    isTemporary,
    expiresAt: isTemporary ? new Date(now.getTime() + temporaryHours * 60 * 60 * 1000).toISOString() : null,
    buildStartedAt: now.toISOString(),
    buildFinishedAt: now.toISOString(),
    buildDurationMs: 400 + Math.floor(Math.random() * 600),
    createdAt: now.toISOString(),
  });

  const logs = [
    "Deployment queued",
    "Starting build",
    `Detected framework: ${project.framework}`,
    "Validating files",
    `Snapshotting ${workingFilesSnap.size} file(s)`,
    "Publishing static assets",
    "Deployment ready",
  ];
  const logsCol = deploymentLogsCol(project.id, deploymentRef.id);
  await Promise.all(
    logs.map((message) => logsCol.add({ message, level: "info", createdAt: new Date().toISOString() }))
  );

  {
    // New production deployment supersedes the previous one for hostname routing.
    const prevProdSnap = await deploymentsCol(project.id).where("isProduction", "==", true).get();
    await Promise.all(
      prevProdSnap.docs
        .filter((d) => d.id !== deploymentRef.id)
        .map((d) => d.ref.update({ isProduction: false }))
    );
  }

  const hostname = `${project.slug}.launchnest.app`;
  const existingDomain = await domainsCol(project.id).where("hostname", "==", hostname).limit(1).get();
  if (existingDomain.empty) {
    await domainsCol(project.id).add({ hostname, isPrimary: true, isCustom: false, createdAt: now.toISOString() });
  }

  const finalSnap = await deploymentRef.get();
  return NextResponse.json(
    { deployment: { id: finalSnap.id, ...finalSnap.data() }, url: `https://${hostname}` },
    { status: 201 }
  );
}
