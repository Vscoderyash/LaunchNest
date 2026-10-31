import Link from "next/link";
import { ArrowRight, Upload, Sparkles, BarChart3, Lock, Rocket } from "lucide-react";
import { GitHubMark } from "@/components/icons/github-mark";

const FEATURES = [
  { icon: Upload,    title: "Upload ZIP",              desc: "Drop a static site and go live in seconds." },
  { icon: GitHubMark, title: "GitHub import",           desc: "Connect a repo and deploy any branch via a personal access token." },
  { icon: Sparkles,  title: "AI website generator",   desc: "Describe it, get a working site — NVIDIA NIM powered." },
  { icon: Lock,      title: "Public, private, unlisted", desc: "Control exactly who sees your site." },
  { icon: BarChart3, title: "Privacy-first analytics", desc: "Page views with no cookies and no stored IPs." },
  { icon: Rocket,    title: "Instant subdomains",      desc: "Every project gets a live *.launchnest.app URL." },
];

const STEPS = [
  { n: "1", label: "Create", desc: "Start blank, upload a ZIP, import from GitHub, or describe it to the AI." },
  { n: "2", label: "Deploy",  desc: "One click. Files are snapshotted so rollback actually restores old content." },
  { n: "3", label: "Live",    desc: "Your site is online. Temporary (24h/7d) or permanent — your choice." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="font-semibold tracking-tight text-lg">LaunchNest</span>
        <div className="flex items-center gap-3">
          <Link href="/explore" className="text-sm text-neutral-400 hover:text-neutral-100">Explore</Link>
          <Link href="/login" className="text-sm text-neutral-400 hover:text-neutral-100">Log in</Link>
          <Link href="/signup" className="text-sm bg-neutral-100 text-neutral-950 px-4 py-2 rounded-full font-medium hover:bg-white">
            Sign up
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-16">
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Build it. Deploy it.<br />Own the web.
        </h1>
        <p className="mt-6 text-lg text-neutral-400 max-w-xl mx-auto">
          Turn an idea into a live website in minutes — no DevOps required.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup" className="inline-flex items-center gap-2 bg-neutral-100 text-neutral-950 px-6 py-3 rounded-full font-medium hover:bg-white">
            Create your website <ArrowRight size={16} />
          </Link>
          <Link href="/explore" className="inline-flex items-center gap-2 border border-neutral-800 px-6 py-3 rounded-full font-medium text-neutral-200 hover:border-neutral-600">
            See what people built
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-8 text-center">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-6">
              <span className="text-3xl font-bold text-neutral-800">{s.n}</span>
              <h3 className="font-semibold mt-2 mb-1">{s.label}</h3>
              <p className="text-sm text-neutral-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-28 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-6">
            <f.icon size={20} className="text-neutral-400 mb-3" />
            <h3 className="font-medium">{f.title}</h3>
            <p className="text-sm text-neutral-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-neutral-800/80 px-6 py-8 text-center text-sm text-neutral-600">
        LaunchNest · Built with Next.js + Firebase · Free during beta
      </footer>
    </main>
  );
}
