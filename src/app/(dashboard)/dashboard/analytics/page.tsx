import Link from "next/link";
import { getSession } from "@/lib/session";
import { projectsCol, analyticsEventsCol, withId, type ProjectDoc } from "@/lib/firestore";
import { rangeStartISO } from "@/lib/analytics";

export default async function AnalyticsPage() {
  const session = await getSession();
  const snap = await projectsCol().where("ownerId", "==", session!.uid).where("deletedAt", "==", null).get();
  const since = rangeStartISO(7);

  const rows = await Promise.all(
    snap.docs.map(async (doc) => {
      const project = withId<ProjectDoc>(doc);
      const count = await analyticsEventsCol(project.id).where("createdAt", ">=", since).count().get();
      return { project, views: count.data().count };
    })
  );
  rows.sort((a, b) => b.views - a.views);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">Page views over the last 7 days. Open a website for the full breakdown.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No websites yet.</p>
      ) : (
        <div className="rounded-xl border border-neutral-800/80 divide-y divide-neutral-800/80">
          {rows.map(({ project, views }) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.slug}?tab=analytics`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900/40"
            >
              <span className="text-sm">{project.name}</span>
              <span className="text-sm text-neutral-400 tabular-nums">
                {project.visibility === "PRIVATE" ? "private" : `${views} views`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
