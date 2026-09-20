"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, LayoutTemplate, FileCode } from "lucide-react";
import { GitHubMark } from "@/components/icons/github-mark";
import { GithubImportPanel } from "@/components/dashboard/github-import-panel";
import { TemplatePickerPanel } from "@/components/dashboard/template-picker-panel";

const METHODS = [
  { id: "blank", label: "Start blank", icon: FileCode, implemented: true },
  { id: "zip", label: "Upload ZIP", icon: Upload, implemented: true },
  { id: "github", label: "Import GitHub", icon: GitHubMark, implemented: true },
  { id: "template", label: "Start from template", icon: LayoutTemplate, implemented: true },
  { id: "ai", label: "Generate with AI", icon: Sparkles, implemented: false, phase: "Phase 5" },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("blank");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC" | "UNLISTED">("PRIVATE");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarnings([]);

    if (method === "zip" && !zipFile) {
      setError("Choose a ZIP file first.");
      return;
    }

    setLoading(true);

    const createRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    const createData = await createRes.json();

    if (!createRes.ok) {
      setLoading(false);
      setError(createData.error ?? "Something went wrong.");
      return;
    }

    if (method === "zip" && zipFile) {
      const form = new FormData();
      form.append("zip", zipFile);
      const uploadRes = await fetch(`/api/projects/${createData.project.id}/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json();
      setLoading(false);

      if (!uploadRes.ok) {
        setError(`Project created, but the ZIP upload failed: ${uploadData.error}`);
        return;
      }
      if (uploadData.warnings?.length) {
        setWarnings(uploadData.warnings);
      }
    } else {
      setLoading(false);
    }

    router.push(`/dashboard/projects/${createData.project.slug}`);
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

      {(method === "blank" || method === "zip") && (
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

          {method === "zip" && (
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">
                ZIP file (must contain index.html at the root, max 20 MB)
              </label>
              <input
                type="file"
                accept=".zip"
                required
                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-200 file:text-sm"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {warnings.map((w) => (
            <p key={w} className="text-xs text-amber-400/90">{w}</p>
          ))}

          <button
            disabled={loading}
            className="bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
        </form>
      )}

      {method === "github" && <GithubImportPanel />}
      {method === "template" && <TemplatePickerPanel />}
    </div>
  );
}
