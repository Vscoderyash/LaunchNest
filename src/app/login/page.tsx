"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitHubMark } from "@/components/icons/github-mark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-1">Log in to LaunchNest</h1>
        <p className="text-sm text-neutral-500 mb-8">Welcome back.</p>

        <button
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-2 border border-neutral-800 rounded-lg py-2.5 mb-6 hover:border-neutral-600 text-sm"
        >
          <GitHubMark size={16} /> Continue with GitHub
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px bg-neutral-800 flex-1" />
          <span className="text-xs text-neutral-600">or</span>
          <div className="h-px bg-neutral-800 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-neutral-100 text-neutral-950 rounded-lg py-2.5 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-sm text-neutral-500 mt-6">
          No account?{" "}
          <Link href="/signup" className="text-neutral-200 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
