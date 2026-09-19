"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, LayoutTemplate, FileCode } from "lucide-react";
import { GitHubMark } from "@/components/icons/github-mark";

const METHODS = [
  { id: "blank", label: "Start blank", icon: FileCode, implemented: true },
  { id: "zip", label: "Upload ZIP", icon: Upload, implemented: false, phase: "Phase 2" },
  { id: "github", label: "Import GitHub", icon: GitHubMark, implemented: false, phase: "Phase 4" },
  { id: "template", label: "Start from template", icon: LayoutTemplate, implemented: false, phase: "Phase 4" },
  { id: "ai", label: "Generate with AI", icon: Sparkles, implemented: false, phase: "Phase 5" },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("blank");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC" | "UNLISTED">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push(`/dashboard/projects/${data.project.slug}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Create a website</h1>
      <p className="text-neutral-500 text-sm mb-8">Idea → create → deploy → live.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={!m.implemented}
            onClick={() => setMethod(m.id)}
            className={`relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
              method === m.id
                ? "border-neutral-500 bg-neutral-900"
                : "border-neutral-800/80 bg-neutral-900/40"
            } ${!m.implemented ? "opacity-50 cursor-not-allowed" : "hover:border-neutral-600"}`}
          >
            <m.icon size={18} className="text-neutral-400" />
            <span className="text-sm font-medium">{m.label}</span>
            {!m.implemented && (
              <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                {m.phase}
              </span>
            )}
          </button>
        ))}
      </div>

      {method === "blank" ? (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-neutral-800/80 p-5">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Project name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-portfolio"
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

          <button
            disabled={loading}
            className="bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-neutral-500">
          This creation method isn&apos;t implemented yet — select &quot;Start blank&quot; to continue now.
        </p>
      )}
    </div>
  );
}
