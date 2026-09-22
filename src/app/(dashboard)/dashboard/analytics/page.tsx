import { BarChart3 } from "lucide-react";

// FUTURE (spec section 15 / Phase 6): per-project analytics dashboard.
// AnalyticsEvent model exists; ingestion + aggregation queries aren't wired yet.
export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="border border-dashed border-neutral-800 rounded-2xl py-16 flex flex-col items-center text-center">
        <BarChart3 size={20} className="text-neutral-600 mb-3" />
        <p className="text-neutral-300 font-medium">Analytics — coming in Phase 6</p>
        <p className="text-neutral-500 text-sm mt-1 max-w-sm">
          Privacy-conscious visitor and page-view stats, no invasive tracking.
        </p>
      </div>
    </div>
  );
}
