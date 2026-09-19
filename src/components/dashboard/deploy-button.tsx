"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";

export function DeployButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deploy() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/deployments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Deployment failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        onClick={deploy}
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-950 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-white disabled:opacity-50"
      >
        <Rocket size={14} /> {loading ? "Deploying…" : "Deploy"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1.5 max-w-xs">{error}</p>}
    </div>
  );
}
