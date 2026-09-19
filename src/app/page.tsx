import Link from "next/link";
import { ArrowRight, Upload, Sparkles, BarChart3, Lock } from "lucide-react";
import { GitHubMark } from "@/components/icons/github-mark";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="font-semibold tracking-tight text-lg">LaunchNest</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-neutral-400 hover:text-neutral-100">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-neutral-100 text-neutral-950 px-4 py-2 rounded-full font-medium hover:bg-white"
          >
            Sign up
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-24">
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Build it. Deploy it.
          <br />
          Own the web.
        </h1>
        <p className="mt-6 text-lg text-neutral-400 max-w-xl mx-auto">
          Turn an idea into a live website in minutes. Upload a ZIP, import a
          GitHub repo, or generate one with AI — LaunchNest handles the rest.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-neutral-100 text-neutral-950 px-6 py-3 rounded-full font-medium hover:bg-white"
          >
            Create your website <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border border-neutral-800 px-6 py-3 rounded-full font-medium text-neutral-200 hover:border-neutral-600"
          >
            Explore templates
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-28 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: Upload, title: "ZIP upload", desc: "Drop a static site and go live in seconds." },
          { icon: GitHubMark, title: "GitHub import", desc: "Connect a repo and deploy any branch." },
          { icon: Sparkles, title: "AI website generator", desc: "Describe it, get a working site." },
          { icon: Lock, title: "Public, private, unlisted", desc: "Control exactly who can see it." },
          { icon: BarChart3, title: "Privacy-first analytics", desc: "Visitors and page views, no invasive tracking." },
          { icon: ArrowRight, title: "Instant subdomains", desc: "Every project gets its own live URL." },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-6"
          >
            <f.icon size={20} className="text-neutral-400 mb-3" />
            <h3 className="font-medium">{f.title}</h3>
            <p className="text-sm text-neutral-500 mt-1">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
