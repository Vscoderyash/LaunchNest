import Link from "next/link";
import { getSession } from "@/lib/session";
import { projectsCol, deploymentsCol, withId, type ProjectDoc, type DeploymentDoc } from "@/lib/firestore";

const STATUS_COLOR: Record<string, string> = {
  READY: "text-green-400",
  BUILDING: "text-amber-400",
  QUEUED: "text-neutral-400",
  FAILED: "text-red-400",
  CANCELLED: "text-neutral-600",
};

export default async function DeploymentsPage() {
  const session = await getSession();

  const projectsSnap = await projectsCol()
    .where("ownerId", "==", session!.uid)
    .where("deletedAt", "==", null)
    .get();
  const projects = projectsSnap.docs.map((d) => withId<ProjectDoc>(d));

  // No ownerId denormalized onto every deployment doc, so this is a
  // per-project fan-out + in-memory merge rather than a Firestore
  // collectionGroup query — avoids needing a composite index to be created
  // in the Firebase console before this page works (see README).
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const snap = await deploymentsCol(project.id).orderBy("createdAt", "desc").limit(10).get();
      return snap.docs.map((d) => ({ ...withId<DeploymentDoc>(d), project }));
    })
  );

  const deployments = perProject
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Deployments</h1>

      {deployments.length === 0 ? (
        <p className="text-neutral-500 text-sm">No deployments yet.</p>
      ) : (
        <div className="rounded-xl border border-neutral-800/80 divide-y divide-neutral-800/80">
          {deployments.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/projects/${d.project.slug}?tab=deployments`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900/40"
            >
              <div>
                <p className="text-sm font-medium">
                  {d.project.name} <span className="text-neutral-600">v{d.version}</span>
                </p>
                <p className="text-xs text-neutral-500">
                  {d.isProduction ? "Production" : d.isTemporary ? "Temporary" : "Preview"} ·{" "}
                  {new Date(d.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`text-xs font-medium ${STATUS_COLOR[d.status]}`}>{d.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
