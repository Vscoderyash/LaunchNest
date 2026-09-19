import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeployButton } from "@/components/dashboard/deploy-button";
import { ImportChangesButton } from "@/components/dashboard/import-changes-button";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      deployments: { orderBy: { version: "desc" } },
      domains: true,
    },
  });

  if (!project || project.deletedAt) notFound();
  if (project.ownerId !== session!.user!.id) notFound(); // no cross-user access (spec section 21)

  const latest = project.deployments[0];
  const primaryDomain = project.domains.find((d) => d.isPrimary);

  const TABS = [
    { label: "Overview", implemented: true },
    { label: "Deployments", implemented: true },
    { label: "Editor", implemented: false, phase: "Phase 4" },
    { label: "Analytics", implemented: false, phase: "Phase 6" },
    { label: "Domains", implemented: false, phase: "Phase 6" },
    { label: "Environment Variables", implemented: false, phase: "Phase 3" },
    { label: "Settings", implemented: true },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="flex items-center gap-3 text-sm mt-1">
            <span className="text-neutral-500">
              {primaryDomain ? `${primaryDomain.hostname} (needs wildcard DNS)` : `${project.slug}.launchnest.app (not deployed yet)`}
            </span>
            {latest?.status === "READY" && (
              <a
                href={`/_sites/${project.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-neutral-300 hover:underline"
              >
                Preview →
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImportChangesButton projectId={project.id} />
          <DeployButton projectId={project.id} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-800/80 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.label}
            disabled={!t.implemented}
            className={`px-3 py-2 text-sm whitespace-nowrap ${
              t.implemented
                ? "text-neutral-200 border-b-2 border-neutral-100 -mb-px"
                : "text-neutral-600 cursor-not-allowed"
            }`}
          >
            {t.label}
            {!t.implemented && <span className="ml-1.5 text-[10px] text-neutral-700">({t.phase})</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Status", value: latest?.status ?? "No deployments" },
          { label: "Framework", value: project.framework },
          { label: "Visibility", value: project.visibility },
          { label: "Created", value: project.createdAt.toLocaleDateString() },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-800/80 p-3.5">
            <p className="text-xs text-neutral-500">{s.label}</p>
            <p className="text-sm font-medium mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-neutral-300 mb-3">Deployment history</h2>
        {project.deployments.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No deployments yet. This project has no files — the Editor (Phase 4) or ZIP upload
            (Phase 2) will let you add files before deploying.
          </p>
        ) : (
          <div className="rounded-xl border border-neutral-800/80 divide-y divide-neutral-800/80">
            {project.deployments.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  v{d.version} {d.isProduction && <span className="text-neutral-600">· production</span>}
                </span>
                <span
                  className={
                    d.status === "READY"
                      ? "text-green-400"
                      : d.status === "FAILED"
                      ? "text-red-400"
                      : "text-neutral-500"
                  }
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
