"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type EnvVar = { id: string; key: string; createdAt: string; updatedAt: string };

export function EnvVarsPanel({ projectId }: { projectId: string }) {
  const [vars, setVars] = useState<EnvVar[] | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/env`);
    const data = await res.json();
    if (res.ok) setVars(data.variables);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/projects/${projectId}/env`);
      const data = await res.json();
      if (!cancelled && res.ok) setVars(data.variables);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/env`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }
    setKey("");
    setValue("");
    load();
  }

  async function handleDelete(envId: string) {
    await fetch(`/api/projects/${projectId}/env/${envId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Values are encrypted at rest and never shown again after creation — only the key names are listed below.
      </p>

      {vars === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : vars.length === 0 ? (
        <p className="text-sm text-neutral-500">No environment variables yet.</p>
      ) : (
        <div className="rounded-xl border border-neutral-800/80 divide-y divide-neutral-800/80">
          {vars.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <code className="text-neutral-300">{v.key}</code>
              <button
                onClick={() => handleDelete(v.id)}
                className="text-neutral-600 hover:text-red-400"
                aria-label={`Delete ${v.key}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          required
          placeholder="KEY_NAME"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600 font-mono"
        />
        <input
          required
          type="password"
          placeholder="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600"
        />
        <button
          disabled={saving}
          className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-950 text-sm font-medium px-3 rounded-lg hover:bg-white disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
