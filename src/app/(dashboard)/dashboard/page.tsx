import Link from "next/link";
import { getSession } from "@/lib/session";
import { getUser, projectsCol, deploymentsCol, withId, type ProjectDoc, type DeploymentDoc } from "@/lib/firestore";
import { getLimitsForTier } from "@/lib/limits";
import { EmptyWebsitesState } from "@/components/dashboard/empty-state";
import { WebsiteCard } from "@/components/dashboard/website-card";

export default async function OverviewPage() {
  const session = await getSession();
  const uid = session!.uid;

  const [user, projectsSnap] = await Promise.all([
    getUser(uid),
    projectsCol().where("ownerId", "==", uid).where("deletedAt", "==", null).orderBy("updatedAt", "desc").get(),
  ]);

  const projects = await Promise.all(
    projectsSnap.docs.map(async (doc) => {
      const latestSnap = await deploymentsCol(doc.id).orderBy("version", "desc").limit(1).get();
      const deployments = latestSnap.docs.map((d) => withId<DeploymentDoc>(d));
      return { ...withId<ProjectDoc>(doc), deployments };
    })
  );

  // Small-scale MVP approach: sum per-project counts rather than a
  // collection-group aggregate (would need a denormalized ownerId field on
  // every deployment doc plus a composite index — not worth it yet).
  const deploymentCounts = await Promise.all(
    projects.map((p) => deploymentsCol(p.id).count().get().then((s) => s.data().count))
  );
  const deploymentCount = deploymentCounts.reduce((a, b) => a + b, 0);

  const limits = getLimitsForTier(user!.planTier);
  const liveCount = projects.filter((p) => p.deployments[0]?.status === "READY").length;

  const stats = [
    { label: "Total Websites", value: `${projects.length} / ${limits.maxProjects}` },
    { label: "Live Websites", value: liveCount },
    { label: "Deployments", value: deploymentCount },
    { label: "Storage Used", value: `0 / ${limits.maxStorageMb} MB` },
    { label: "Bandwidth Used", value: `0 / ${limits.maxBandwidthMb} MB` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Welcome back{user?.name ? `, ${user.name}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4"
          >
            <p className="text-xs text-neutral-500">{s.label}</p>
            <p className="text-xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-neutral-300">Your websites</h2>
          <Link href="/dashboard/websites" className="text-sm text-neutral-500 hover:text-neutral-200">
            View all
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyWebsitesState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project) => (
              <WebsiteCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
