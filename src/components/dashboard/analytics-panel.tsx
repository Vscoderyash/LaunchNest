import Link from "next/link";
import { analyticsEventsCol, type AnalyticsEventDoc } from "@/lib/firestore";
import { aggregateEvents, rangeStartISO } from "@/lib/analytics";

const MAX_EVENTS = 5000;

function Table({ title, rows }: { title: string; rows: { key: string; count: number }[] }) {
  return (
    <div className="rounded-xl border border-neutral-800/80 p-4">
      <p className="text-xs text-neutral-500 mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600">No data yet</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between text-sm">
              <span className="truncate text-neutral-300 pr-3">{r.key}</span>
              <span className="text-neutral-500 tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function AnalyticsPanel({
  projectId,
  slug,
  visibility,
  days,
}: {
  projectId: string;
  slug: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  days: 7 | 30;
}) {
  // Single-field range filter on a subcollection: no composite index needed.
  const snap = await analyticsEventsCol(projectId)
    .where("createdAt", ">=", rangeStartISO(days))
    .limit(MAX_EVENTS)
    .get();
  const summary = aggregateEvents(snap.docs.map((d) => d.data() as AnalyticsEventDoc));
  const truncated = snap.size >= MAX_EVENTS;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          Cookie-free and IP-free: unique visitors are counted with a daily-rotating hash, so nobody can be followed across days.
        </p>
        <div className="flex gap-1 text-xs">
          {([7, 30] as const).map((d) => (
            <Link
              key={d}
              href={`/dashboard/projects/${slug}?tab=analytics&range=${d}`}
              className={`px-2.5 py-1 rounded-md border ${days === d ? "border-neutral-500 bg-neutral-800 text-neutral-100" : "border-neutral-800 text-neutral-500 hover:text-neutral-200"}`}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      {visibility === "PRIVATE" && (
        <p className="text-sm text-amber-400/90">
          This website is private, so visits aren&apos;t counted. Switch it to Public or Unlisted in Settings to collect analytics.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-800/80 p-4">
          <p className="text-xs text-neutral-500">Page views</p>
          <p className="text-2xl font-semibold mt-1">{summary.pageViews}</p>
        </div>
        <div className="rounded-xl border border-neutral-800/80 p-4">
          <p className="text-xs text-neutral-500">Unique visitors</p>
          <p className="text-2xl font-semibold mt-1">{summary.uniqueVisitors}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Table title="Top pages" rows={summary.topPages} />
        <Table title="Referrers" rows={summary.referrers} />
        <Table title="Countries" rows={summary.countries} />
        <Table title="Devices" rows={summary.devices} />
        <Table title="Browsers" rows={summary.browsers} />
      </div>

      {truncated && (
        <p className="text-xs text-neutral-600">Showing the most recent {MAX_EVENTS} events in this range.</p>
      )}
    </div>
  );
}
