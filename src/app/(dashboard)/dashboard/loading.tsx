// Shown instantly while a dashboard page's server data loads, so navigation
// responds immediately instead of freezing on the previous page.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-neutral-800/70" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-neutral-800/80 bg-neutral-900/40" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl border border-neutral-800/80 bg-neutral-900/40" />
        ))}
      </div>
    </div>
  );
}
