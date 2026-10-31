"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Globe, Rocket, LayoutTemplate,
  BarChart3, Settings, Upload, Sparkles, X,
} from "lucide-react";

type Command = { id: string; label: string; icon: React.ElementType; action: () => void; keywords: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: "new",         label: "Create Website",     icon: Plus,          action: () => router.push("/dashboard/projects/new"),          keywords: "create new site" },
    { id: "new-blank",   label: "Start blank",         icon: Plus,          action: () => router.push("/dashboard/projects/new"),          keywords: "blank empty" },
    { id: "new-zip",     label: "Upload ZIP",          icon: Upload,        action: () => router.push("/dashboard/projects/new?m=zip"),    keywords: "upload zip" },
    { id: "new-ai",      label: "Generate with AI",    icon: Sparkles,      action: () => router.push("/dashboard/projects/new?m=ai"),     keywords: "ai generate" },
    { id: "websites",    label: "My Websites",         icon: Globe,         action: () => router.push("/dashboard/websites"),              keywords: "projects list" },
    { id: "deployments", label: "Deployments",         icon: Rocket,        action: () => router.push("/dashboard/deployments"),           keywords: "deploy history" },
    { id: "templates",   label: "Templates",           icon: LayoutTemplate,action: () => router.push("/dashboard/templates"),             keywords: "template" },
    { id: "analytics",   label: "Analytics",           icon: BarChart3,     action: () => router.push("/dashboard/analytics"),             keywords: "stats visitors" },
    { id: "settings",    label: "Settings",            icon: Settings,      action: () => router.push("/dashboard/settings"),              keywords: "account profile" },
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) {
      filtered[selected].action();
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg mx-4 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
          <Search size={16} className="text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600"
          />
          <button onClick={() => setOpen(false)} className="text-neutral-600 hover:text-neutral-300">
            <X size={14} />
          </button>
        </div>
        <ul className="py-1.5 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-neutral-600">No results</li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left ${
                    i === selected ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                  }`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => { cmd.action(); setOpen(false); }}
                >
                  <cmd.icon size={15} className="shrink-0 text-neutral-500" />
                  {cmd.label}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="px-4 py-2 border-t border-neutral-800 flex gap-4 text-[11px] text-neutral-700">
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}
