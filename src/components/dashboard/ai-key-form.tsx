"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

type Status = { source: "user" | "server" | "none"; provider?: string; last4?: string };

export function AiKeyForm() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/ai").then((r) => r.json()).then(setStatus);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save.");
    setStatus(data);
    setKey("");
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/settings/ai", { method: "DELETE" });
    const r = await fetch("/api/settings/ai");
    setStatus(await r.json());
    setBusy(false);
  }

  const name = status?.provider === "anthropic" ? "Anthropic" : "NVIDIA";

  return (
    <div className="rounded-xl border border-neutral-800/80 p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 text-neutral-300">
        <Sparkles size={14} />
        {status === null && "Checking…"}
        {status?.source === "user" && <>Using your {name} key ending <code>…{status.last4}</code></>}
        {status?.source === "server" && "Using LaunchNest's shared key — add your own to avoid limits"}
        {status?.source === "none" && "No AI key yet — paste one to enable “Generate with AI”"}
      </div>
      <form onSubmit={save} className="flex gap-2">
        <input
          type="password"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="nvapi-… or sk-ant-…"
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600 font-mono"
        />
        <button disabled={busy} className="bg-neutral-100 text-neutral-950 font-medium px-3.5 rounded-lg hover:bg-white disabled:opacity-50">
          Save
        </button>
        {status?.source === "user" && (
          <button type="button" onClick={remove} disabled={busy} className="border border-neutral-800 text-neutral-400 px-3 rounded-lg hover:border-neutral-600">
            Remove
          </button>
        )}
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-neutral-600">
        Get a free NVIDIA key at build.nvidia.com. Stored encrypted, used only for your generations, never shown again.
      </p>
    </div>
  );
}
