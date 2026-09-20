"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

type FileEntry = { path: string; content: string | null };

function buildPreviewSrcDoc(files: FileEntry[]): string {
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.content ?? ""]));
  const html = byPath["index.html"];
  if (!html) return "<p style='font-family:system-ui;color:#888;padding:2rem'>No index.html yet.</p>";

  // Naive single-page inlining: works for the common index.html + style.css +
  // script.js shape. Files referenced via <link>/<script src> to *other*
  // paths won't resolve inside this srcDoc sandbox — proper multi-file
  // preview would need blob URLs or a service worker (FUTURE).
  let combined = html;
  if (byPath["style.css"]) {
    combined = combined.includes("</head>")
      ? combined.replace("</head>", `<style>${byPath["style.css"]}</style></head>`)
      : `<style>${byPath["style.css"]}</style>` + combined;
  }
  if (byPath["script.js"]) {
    combined = combined.includes("</body>")
      ? combined.replace("</body>", `<script>${byPath["script.js"]}</script></body>`)
      : combined + `<script>${byPath["script.js"]}</script>`;
  }
  return combined;
}

export function SimpleEditor({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/files`)
      .then((r) => r.json())
      .then((d) => {
        const list: FileEntry[] = d.files ?? [];
        setFiles(list);
        const first = list.find((f) => f.content !== null) ?? list[0];
        if (first) {
          setActivePath(first.path);
          setDraft(first.content ?? "");
        }
      });
  }, [projectId]);

  function selectFile(path: string) {
    const file = files?.find((f) => f.path === path);
    setActivePath(path);
    setDraft(file?.content ?? "");
    setError(null);
  }

  async function handleSave() {
    if (!activePath) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: activePath, content: draft }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
      return;
    }
    setFiles((prev) =>
      prev
        ? prev.some((f) => f.path === activePath)
          ? prev.map((f) => (f.path === activePath ? { ...f, content: draft } : f))
          : [...prev, { path: activePath, content: draft }]
        : prev
    );
    setSavedAt(Date.now());
  }

  function handleNewFile() {
    const path = newFileName.trim();
    if (!path) return;
    setFiles((prev) => (prev ? [...prev, { path, content: "" }] : [{ path, content: "" }]));
    setActivePath(path);
    setDraft("");
    setNewFileName("");
  }

  const previewSrcDoc = useMemo(() => {
    if (!files) return "";
    // Reflect the in-progress draft immediately, not just the last save.
    const withDraft = files.map((f) => (f.path === activePath ? { ...f, content: draft } : f));
    return buildPreviewSrcDoc(withDraft);
  }, [files, activePath, draft]);

  if (files === null) {
    return <p className="text-sm text-neutral-500">Loading files…</p>;
  }

  return (
    <div className="grid grid-cols-[160px_1fr_1fr] gap-3 h-[520px]">
      <div className="border border-neutral-800/80 rounded-xl p-2 overflow-y-auto">
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => selectFile(f.path)}
            className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-mono truncate ${
              activePath === f.path ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {f.path}
            {f.content === null && <span className="text-neutral-700"> (binary)</span>}
          </button>
        ))}
        <div className="flex gap-1 mt-2 px-1">
          <input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNewFile()}
            placeholder="new-file.html"
            className="min-w-0 flex-1 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-[11px] font-mono outline-none"
          />
          <button onClick={handleNewFile} className="text-neutral-500 hover:text-neutral-200 shrink-0">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col border border-neutral-800/80 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/80 text-xs">
          <span className="font-mono text-neutral-400">{activePath ?? "No file selected"}</span>
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-neutral-600">Saved</span>}
            <button
              onClick={handleSave}
              disabled={saving || !activePath}
              className="bg-neutral-100 text-neutral-950 px-2.5 py-1 rounded font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!activePath}
          spellCheck={false}
          className="flex-1 bg-neutral-950 text-neutral-200 font-mono text-xs p-3 outline-none resize-none"
        />
        {error && <p className="text-xs text-red-400 px-3 py-1.5">{error}</p>}
      </div>

      <div className="border border-neutral-800/80 rounded-xl overflow-hidden bg-white">
        <iframe title="Live preview" srcDoc={previewSrcDoc} sandbox="allow-scripts" className="w-full h-full" />
      </div>
    </div>
  );
}
