"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RollbackButton({
  projectId,
  deploymentId,
}: {
  projectId: string;
  deploymentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rollback() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/deployments/${deploymentId}/rollback`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Rollback failed.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={rollback}
        disabled={loading}
        className="text-xs text-neutral-400 hover:text-neutral-100 underline decoration-dotted disabled:opacity-50"
      >
        {loading ? "Rolling back…" : "Roll back to this"}
      </button>
      {error && <span className="text-[11px] text-red-400 mt-0.5">{error}</span>}
    </span>
  );
}
