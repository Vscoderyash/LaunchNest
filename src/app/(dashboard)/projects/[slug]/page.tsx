import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeployButton } from "@/components/dashboard/deploy-button";
import { ImportChangesButton } from "@/components/dashboard/import-changes-button";
import { RollbackButton } from "@/components/dashboard/rollback-button";
import { EnvVarsPanel } from "@/components/dashboard/env-vars-panel";
import { ProjectSettingsForm } from "@/components/dashboard/project-settings-form";
import { SimpleEditor } from "@/components/dashboard/simple-editor";

const TABS = [
  { key: "overview", label: "Overview", implemented: true },
  { key: "deployments", label: "Deployments", implemented: true },
  { key: "editor", label: "Editor", implemented: true },
  { key: "analytics", label: "Analytics", implemented: false, phase: "Phase 6" },
  { key: "domains", label: "Domains", implemented: false, phase: "Phase 6" },
  { key: "env", label: "Environment Variables", implemented: true },
  { key: "settings", label: "Settings", implemented: true },
] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab && t.implemented) ? tab! : "overview";
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
        {TABS.map((t) =>
          t.implemented ? (
            <Link
              key={t.key}
              href={`/dashboard/projects/${slug}?tab=${t.key}`}
              className={`px-3 py-2 text-sm whitespace-nowrap ${
                activeTab === t.key
                  ? "text-neutral-100 border-b-2 border-neutral-100 -mb-px"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {t.label}
            </Link>
          ) : (
            <span key={t.key} className="px-3 py-2 text-sm whitespace-nowrap text-neutral-600 cursor-not-allowed">
              {t.label} <span className="ml-1 text-[10px] text-neutral-700">({t.phase})</span>
            </span>
          )
        )}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
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

          {project.deployments.length === 0 && (
            <p className="text-sm text-neutral-500">
              No deployments yet. Use &quot;Import Changes (ZIP)&quot; above to add files, then Deploy.
            </p>
          )}
        </div>
      )}

      {activeTab === "deployments" && (
        <div>
          {project.deployments.length === 0 ? (
            <p className="text-sm text-neutral-500">No deployments yet.</p>
          ) : (
            <div className="rounded-xl border border-neutral-800/80 divide-y divide-neutral-800/80">
              {project.deployments.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    v{d.version} {d.isProduction && <span className="text-neutral-600">· production</span>}
                    {d.isTemporary && <span className="text-neutral-600"> · temporary</span>}
                  </span>
                  <div className="flex items-center gap-3">
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
                    {d.status === "READY" && !d.isProduction && (
                      <RollbackButton projectId={project.id} deploymentId={d.id} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "editor" && <SimpleEditor projectId={project.id} />}

      {activeTab === "env" && <EnvVarsPanel projectId={project.id} />}

      {activeTab === "settings" && (
        <ProjectSettingsForm
          projectId={project.id}
          initialName={project.name}
          initialVisibility={project.visibility}
        />
      )}
    </div>
  );
}
