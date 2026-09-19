"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectSettingsForm({
  projectId,
  initialName,
  initialVisibility,
}: {
  projectId: string;
  initialName: string;
  initialVisibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This can't be undone from the dashboard.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/websites");
    } else {
      setDeleting(false);
      setError("Failed to delete project.");
    }
  }

  return (
    <div className="space-y-8 max-w-md">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Project name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Visibility</label>
          <div className="flex gap-2">
            {(["PRIVATE", "PUBLIC", "UNLISTED"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVisibility(v)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  visibility === v
                    ? "border-neutral-500 bg-neutral-800"
                    : "border-neutral-800 text-neutral-500"
                }`}
              >
                {v.charAt(0) + v.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-green-400">Saved.</p>}
        <button
          disabled={saving}
          className="bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2 rounded-lg hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="border-t border-neutral-800 pt-6">
        <p className="text-sm font-medium text-red-400 mb-2">Danger zone</p>
        <p className="text-xs text-neutral-500 mb-3">
          Deleting a project removes it from your dashboard and frees its
          subdomain. Deployment history is retained for now (soft delete).
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="border border-red-900/60 text-red-400 text-sm px-3.5 py-2 rounded-lg hover:bg-red-950/40 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete project"}
        </button>
      </div>
    </div>
  );
}
