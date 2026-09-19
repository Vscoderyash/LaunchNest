import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_COLOR: Record<string, string> = {
  READY: "text-green-400",
  BUILDING: "text-amber-400",
  QUEUED: "text-neutral-400",
  FAILED: "text-red-400",
  CANCELLED: "text-neutral-600",
};

export default async function DeploymentsPage() {
  const session = await auth();
  const deployments = await prisma.deployment.findMany({
    where: { project: { ownerId: session!.user!.id as string } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { project: true },
  });

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
                  {d.createdAt.toLocaleString()}
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
