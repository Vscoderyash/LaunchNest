"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Template = { id: string; name: string; description: string; category: string; tags: string[] };

export function TemplatePickerPanel() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC" | "UNLISTED">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const createRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      setLoading(false);
      setError(createData.error ?? "Failed to create project.");
      return;
    }

    const applyRes = await fetch(`/api/projects/${createData.project.id}/apply-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    setLoading(false);
    if (!applyRes.ok) {
      const applyData = await applyRes.json();
      setError(`Project created, but applying the template failed: ${applyData.error}`);
      return;
    }

    router.push(`/dashboard/projects/${createData.project.slug}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {templates === null ? (
        <p className="text-sm text-neutral-500">Loading templates…</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                templateId === t.id
                  ? "border-neutral-500 bg-neutral-900"
                  : "border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-600"
              }`}
            >
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-neutral-500 mt-1">{t.description}</p>
              <p className="text-[10px] text-neutral-600 mt-2">{t.category}</p>
            </button>
          ))}
        </div>
      )}

      {templateId && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-800/80 p-5 max-w-md">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Project name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-site"
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
                    visibility === v ? "border-neutral-500 bg-neutral-800" : "border-neutral-800 text-neutral-500"
                  }`}
                >
                  {v.charAt(0) + v.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={loading}
            className="bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Use this template"}
          </button>
        </form>
      )}
    </div>
  );
}
