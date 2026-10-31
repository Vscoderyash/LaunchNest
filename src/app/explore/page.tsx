import Link from "next/link";
import { Globe } from "lucide-react";
import { projectsCol, deploymentsCol } from "@/lib/firestore";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  // Only PUBLIC sites that have at least one READY deployment.
  const snap = await projectsCol()
    .where("visibility", "==", "PUBLIC")
    .where("deletedAt", "==", null)
    .limit(48)
    .get();

  const projects = (
    await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const dep = await deploymentsCol(d.id)
          .where("status", "==", "READY")
          .where("isProduction", "==", true)
          .limit(1)
          .get();
        if (dep.empty) return null;
        return { id: d.id, name: data.name as string, slug: data.slug as string, framework: data.framework as string };
      })
    )
  ).filter(Boolean) as { id: string; name: string; slug: string; framework: string }[];

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-10">
        <Link href="/" className="text-neutral-500 hover:text-neutral-100 text-sm">LaunchNest</Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-2xl font-semibold">Explore</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-8">Public websites built and deployed on LaunchNest.</p>

      {projects.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-2xl py-16 text-center">
          <Globe size={20} className="mx-auto text-neutral-600 mb-3" />
          <p className="text-neutral-500 text-sm">No public websites yet. Be the first!</p>
          <Link href="/signup" className="mt-4 inline-block text-sm text-neutral-300 hover:underline">
            Create yours →
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <a
              key={p.id}
              href={`/sites/${p.slug}`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-5 hover:border-neutral-600 transition-colors group"
            >
              <div className="aspect-video rounded-lg bg-neutral-800/60 mb-3 flex items-center justify-center text-neutral-600 text-xs">
                preview
              </div>
              <p className="font-medium group-hover:text-white transition-colors">{p.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{p.slug}.launchnest.app</p>
              <p className="text-xs text-neutral-700 mt-1.5">{p.framework}</p>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
