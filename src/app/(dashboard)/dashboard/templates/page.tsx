import Link from "next/link";
import { templatesCol, withId, type TemplateDoc } from "@/lib/firestore";

export default async function TemplatesPage() {
  const snap = await templatesCol().orderBy("name", "asc").get();
  const templates = snap.docs.map((d) => withId<TemplateDoc>(d));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Link
          href="/dashboard/projects/new"
          className="text-sm text-neutral-400 hover:text-neutral-100"
        >
          Use one to create a website →
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No templates seeded yet — run <code>npm run seed</code>.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-neutral-500 mt-1">{t.description}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-neutral-600">
                <span>{t.category}</span>
                <span>·</span>
                <span>{t.framework}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
