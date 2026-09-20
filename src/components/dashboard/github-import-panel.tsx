"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Repo = { fullName: string; defaultBranch: string; private: boolean };

export function GithubImportPanel() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null | undefined>(undefined); // undefined = loading
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [repo, setRepo] = useState("");
  const [branches, setBranches] = useState<string[] | null>(null);
  const [branch, setBranch] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC" | "UNLISTED">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch("/api/github/connect")
      .then((r) => r.json())
      .then((d) => setUsername(d.connection?.githubUsername ?? null));
  }, []);

  useEffect(() => {
    if (username) {
      fetch("/api/github/repos")
        .then((r) => r.json())
        .then((d) => setRepos(d.repos ?? []));
    }
  }, [username]);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    (async () => {
      setBranches(null);
      const res = await fetch(`/api/github/branches?repo=${encodeURIComponent(repo)}`);
      const d = await res.json();
      if (cancelled) return;
      setBranches(d.branches ?? []);
      const selected = repos?.find((r) => r.fullName === repo);
      setBranch(selected?.defaultBranch ?? d.branches?.[0] ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, repos]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConnecting(true);
    const res = await fetch("/api/github/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    setConnecting(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to connect.");
      return;
    }
    setUsername(data.connection.githubUsername);
    setToken("");
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarnings([]);
    setImporting(true);

    const createRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      setImporting(false);
      setError(createData.error ?? "Failed to create project.");
      return;
    }

    const importRes = await fetch(`/api/projects/${createData.project.id}/import-github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoFullName: repo, branch }),
    });
    const importData = await importRes.json();
    setImporting(false);

    if (!importRes.ok) {
      setError(`Project created, but the import failed: ${importData.error}`);
      return;
    }
    if (importData.warnings?.length) setWarnings(importData.warnings);

    router.push(`/dashboard/projects/${createData.project.slug}`);
  }

  if (username === undefined) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  if (!username) {
    return (
      <form onSubmit={handleConnect} className="space-y-3 rounded-xl border border-neutral-800/80 p-5 max-w-md">
        <p className="text-sm text-neutral-400">
          Paste a GitHub personal access token (classic, with the <code>repo</code> scope, or
          fine-grained with Contents: Read) to connect your account. It&apos;s encrypted at rest
          and never sent back to your browser.
        </p>
        <input
          required
          type="password"
          placeholder="ghp_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600 font-mono"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={connecting}
          className="bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2 rounded-lg hover:bg-white disabled:opacity-50"
        >
          {connecting ? "Connecting…" : "Connect GitHub"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleImport} className="space-y-4 rounded-xl border border-neutral-800/80 p-5 max-w-md">
      <p className="text-xs text-neutral-500">Connected as <span className="text-neutral-300">{username}</span></p>

      <div>
        <label className="text-xs text-neutral-500 mb-1.5 block">Repository</label>
        <select
          required
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        >
          <option value="">{repos === null ? "Loading…" : "Select a repository"}</option>
          {repos?.map((r) => (
            <option key={r.fullName} value={r.fullName}>
              {r.fullName}
            </option>
          ))}
        </select>
      </div>

      {repo && (
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Branch</label>
          <select
            required
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          >
            {branches === null ? (
              <option>Loading…</option>
            ) : (
              branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))
            )}
          </select>
        </div>
      )}

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
        disabled={importing || !repo || !branch}
        className="bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-white disabled:opacity-50"
      >
        {importing ? "Importing…" : "Import and create project"}
      </button>
    </form>
  );
}
