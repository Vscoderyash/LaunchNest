import Link from "next/link";
import { Globe, Lock, EyeOff } from "lucide-react";
import type { ProjectDoc, DeploymentDoc } from "@/lib/firestore";

const VISIBILITY_ICON = { PUBLIC: Globe, PRIVATE: Lock, UNLISTED: EyeOff } as const;

export function WebsiteCard({
  project,
}: {
  project: ({ id: string } & ProjectDoc) & { deployments: ({ id: string } & DeploymentDoc)[] };
}) {
  const latest = project.deployments[0];
  const VisibilityIcon = VISIBILITY_ICON[project.visibility];
  const isLive = latest?.status === "READY";

  return (
    <Link
      href={`/dashboard/projects/${project.slug}`}
      className="block rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4 hover:border-neutral-700 transition-colors"
    >
      <div className="aspect-video rounded-lg bg-neutral-800/60 mb-3 flex items-center justify-center text-neutral-600 text-xs">
        No preview yet
      </div>
      <div className="flex items-center justify-between">
        <p className="font-medium truncate">{project.name}</p>
        <span
          className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400" : "bg-neutral-600"}`}
        />
      </div>
      <p className="text-xs text-neutral-500 mt-0.5 truncate">
        {project.slug}.launchnest.app
      </p>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-2">
        <VisibilityIcon size={12} />
        {project.visibility.toLowerCase()}
        <span className="text-neutral-700">·</span>
        {project.framework}
      </div>
    </Link>
  );
}
