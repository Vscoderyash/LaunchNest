import { getSession } from "@/lib/session";
import { getUser } from "@/lib/firestore";
import { getLimitsForTier } from "@/lib/limits";

export default async function SettingsPage() {
  const session = await getSession();
  const user = await getUser(session!.uid);
  const limits = getLimitsForTier(user!.planTier);

  return (
    <div className="space-y-8 max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-300">Account</h2>
        <div className="rounded-xl border border-neutral-800/80 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Name</span>
            <span>{user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Email</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-300">Plan</h2>
        <div className="rounded-xl border border-neutral-800/80 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Current plan</span>
            <span>{user?.planTier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Website limit</span>
            <span>{limits.maxProjects}</span>
          </div>
          <p className="text-xs text-neutral-600 pt-2">
            Billing and plan upgrades are FUTURE (Phase 7) — no payments are implemented yet.
          </p>
        </div>
      </section>
    </div>
  );
}
