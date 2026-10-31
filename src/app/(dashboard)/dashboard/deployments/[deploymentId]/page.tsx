import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getProjectBySlug, deploymentsCol, deploymentLogsCol, projectsCol, withId, type DeploymentDoc } from "@/lib/firestore";
import { expiryLabel } from "@/lib/deployments";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader } from "lucide-react";

const STATUS_ICON = {
  READY:     <CheckCircle size={16} className="text-green-400" />,
  FAILED:    <XCircle    size={16} className="text-red-400"   />,
  QUEUED:    <Clock      size={16} className="text-neutral-400"/>,
  BUILDING:  <Loader     size={16} className="text-amber-400 animate-spin"/>,
  CANCELLED: <XCircle    size={16} className="text-neutral-600"/>,
} as const;

const LEVEL_COLOR = { info: "text-neutral-400", warn: "text-amber-400", error: "text-red-400" } as const;

export default async function DeploymentPage({
  params,
}: {
  params: Promise<{ deploymentId: string }>;
}) {
  const { deploymentId } = await params;
  const session = await getSession();

  // Find the project that owns this deployment via a collectionGroup-style fan-out.
  // We store ownerId on the deployment, so no cross-user leak is possible.
  const projectsSnap = await projectsCol()
    .where("ownerId", "==", session!.uid)
    .where("deletedAt", "==", null)
    .get();

  let project = null;
  let deployment: (DeploymentDoc & { id: string }) | null = null;

  for (const pdoc of projectsSnap.docs) {
    const dSnap = await deploymentsCol(pdoc.id).doc(deploymentId).get();
    if (dSnap.exists) {
      project = { id: pdoc.id, ...pdoc.data() } as { id: string; name: string; slug: string };
      deployment = withId<DeploymentDoc>(dSnap);
      break;
    }
  }

  if (!project || !deployment) notFound();

  const logsSnap = await deploymentLogsCol(project.id, deploymentId)
    .orderBy("createdAt", "asc")
    .get();

  const durationSec = deployment.buildDurationMs
    ? (deployment.buildDurationMs / 1000).toFixed(1)
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/dashboard/projects/${project.slug}?tab=deployments`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-200"
      >
        <ArrowLeft size={14} /> {project.name}
      </Link>

      <div className="flex items-center gap-3">
        {STATUS_ICON[deployment.status as keyof typeof STATUS_ICON] ?? null}
        <div>
          <h1 className="text-xl font-semibold">
            Deployment v{deployment.version}
            {deployment.isProduction && <span className="ml-2 text-xs text-neutral-500 font-normal">production</span>}
            {deployment.isTemporary && (
              <span className="ml-2 text-xs text-amber-400/80 font-normal">
                temporary · {expiryLabel(deployment.expiresAt)}
              </span>
            )}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {deployment.source} · started {new Date(deployment.createdAt).toLocaleString()}
            {durationSec && ` · ${durationSec}s`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800/80 bg-neutral-950 overflow-hidden">
        <div className="px-4 py-2 border-b border-neutral-800/80 text-xs text-neutral-500">
          Build log
        </div>
        <div className="p-4 font-mono text-xs space-y-1 max-h-[60vh] overflow-y-auto">
          {logsSnap.empty ? (
            <span className="text-neutral-600">No log entries.</span>
          ) : (
            logsSnap.docs.map((d) => {
              const { message, level, createdAt } = d.data();
              const color = LEVEL_COLOR[level as keyof typeof LEVEL_COLOR] ?? "text-neutral-400";
              return (
                <div key={d.id} className="flex gap-3">
                  <span className="text-neutral-700 shrink-0">
                    {new Date(createdAt).toLocaleTimeString()}
                  </span>
                  <span className={color}>{message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
