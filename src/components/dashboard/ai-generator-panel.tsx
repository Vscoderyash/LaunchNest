"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export function AiGeneratorPanel() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [colorPreference, setColorPreference] = useState("");
  const [websiteType, setWebsiteType] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [animationLevel, setAnimationLevel] = useState<"none" | "subtle" | "playful">("subtle");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC" | "UNLISTED">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarnings([]);
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

    const genRes = await fetch(`/api/projects/${createData.project.id}/generate-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style, colorPreference, websiteType, darkMode, animationLevel }),
    });
    const genData = await genRes.json();
    setLoading(false);

    if (!genRes.ok) {
      setError(`Project created, but generation failed: ${genData.error}`);
      return;
    }
    if (genData.warnings?.length) setWarnings(genData.warnings);

    router.push(`/dashboard/projects/${createData.project.slug}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-neutral-800/80 p-5 max-w-lg">
      <div>
        <label className="text-xs text-neutral-500 mb-1.5 block">Describe the website</label>
        <textarea
          required
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A futuristic portfolio for a student who makes AI and Arduino projects."
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Website type</label>
          <input
            value={websiteType}
            onChange={(e) => setWebsiteType(e.target.value)}
            placeholder="portfolio, landing page…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Style</label>
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="minimal, playful…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Color preference</label>
          <input
            value={colorPreference}
            onChange={(e) => setColorPreference(e.target.value)}
            placeholder="blue and black…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Animation level</label>
          <select
            value={animationLevel}
            onChange={(e) => setAnimationLevel(e.target.value as typeof animationLevel)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600"
          >
            <option value="none">None</option>
            <option value="subtle">Subtle</option>
            <option value="playful">Playful</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDarkMode((v) => !v)}
        className={`px-3 py-1.5 rounded-lg text-sm border ${darkMode ? "border-neutral-500 bg-neutral-800" : "border-neutral-800 text-neutral-500"}`}
      >
        {darkMode ? "Dark mode" : "Light mode"}
      </button>

      <div>
        <label className="text-xs text-neutral-500 mb-1.5 block">Project name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-ai-site"
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
      {warnings.map((w) => (
        <p key={w} className="text-xs text-amber-400/90">{w}</p>
      ))}

      <button
        disabled={loading}
        className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-white disabled:opacity-50"
      >
        <Sparkles size={14} /> {loading ? "Generating…" : "Generate and create project"}
      </button>
    </form>
  );
}
