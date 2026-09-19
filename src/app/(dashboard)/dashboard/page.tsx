import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLimitsForTier } from "@/lib/limits";
import { EmptyWebsitesState } from "@/components/dashboard/empty-state";
import { WebsiteCard } from "@/components/dashboard/website-card";

export default async function OverviewPage() {
  const session = await auth();
  const userId = session!.user!.id as string;

  const [user, projects, deploymentCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.project.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { deployments: { orderBy: { version: "desc" }, take: 1 } },
    }),
    prisma.deployment.count({ where: { project: { ownerId: userId } } }),
  ]);

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
