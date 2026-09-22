"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { Search, Plus, Bell } from "lucide-react";

export function Topbar({ userName }: { userName?: string | null }) {
  const router = useRouter();

  async function handleSignOut() {
    await firebaseSignOut(firebaseAuth);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/");
  }

  return (
    <header className="flex items-center justify-between border-b border-neutral-800/80 px-6 py-3.5">
      <div className="flex items-center gap-2 text-neutral-500 text-sm bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 w-72">
        <Search size={14} />
        <span>Search… (⌘K)</span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-1.5 bg-neutral-100 text-neutral-950 text-sm font-medium px-3.5 py-1.5 rounded-lg hover:bg-white"
        >
          <Plus size={14} /> Create Website
        </Link>
        <button className="text-neutral-400 hover:text-neutral-100">
          <Bell size={18} />
        </button>
        <button
          onClick={handleSignOut}
          className="w-8 h-8 rounded-full bg-neutral-800 text-xs flex items-center justify-center hover:bg-neutral-700"
          title={userName ?? "Account"}
        >
          {(userName ?? "U").slice(0, 1).toUpperCase()}
        </button>
      </div>
    </header>
  );
}
