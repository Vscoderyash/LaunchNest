import Link from "next/link";
import { Rocket } from "lucide-react";

export function EmptyWebsitesState() {
  return (
    <div className="border border-dashed border-neutral-800 rounded-2xl py-16 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
        <Rocket size={18} className="text-neutral-500" />
      </div>
      <p className="text-neutral-300 font-medium">You haven&apos;t created a website yet.</p>
      <p className="text-neutral-500 text-sm mt-1">Go from idea to live URL in a few minutes.</p>
      <Link
        href="/dashboard/projects/new"
        className="mt-5 bg-neutral-100 text-neutral-950 text-sm font-medium px-4 py-2 rounded-lg hover:bg-white"
      >
        Create your first website
      </Link>
    </div>
  );
}
