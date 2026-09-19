"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export function ImportChangesButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("zip", file);
    const res = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setLoading(false);
    e.target.value = "";

    if (!res.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 border border-neutral-800 text-sm px-3.5 py-2 rounded-lg hover:border-neutral-600 disabled:opacity-50"
      >
        <Upload size={14} /> {loading ? "Uploading…" : "Import Changes (ZIP)"}
      </button>
      <input ref={inputRef} type="file" accept=".zip" hidden onChange={handleFile} />
      {error && <p className="text-xs text-red-400 mt-1.5 max-w-xs">{error}</p>}
    </div>
  );
}
