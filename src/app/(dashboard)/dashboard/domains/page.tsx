import { getSession } from "@/lib/session";
import { projectsCol, domainsCol, withId, type DomainDoc } from "@/lib/firestore";
import { Network } from "lucide-react";

export default async function DomainsPage() {
  const session = await getSession();
  const projectsSnap = await projectsCol()
    .where("ownerId", "==", session!.uid)
    .where("deletedAt", "==", null)
    .get();

  const domainsByProject = await Promise.all(
    projectsSnap.docs.map(async (doc) => {
      const domainsSnap = await domainsCol(doc.id).orderBy("createdAt", "desc").get();
      return domainsSnap.docs.map((d) => ({
        ...withId<DomainDoc>(d),
        projectName: doc.data().name as string,
      }));
    })
  );
  const domains = domainsByProject.flat();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Domains</h1>
      <p className="text-neutral-500 text-sm -mt-4">
        Every project gets a free <code>*.launchnest.app</code> subdomain automatically.
        Custom domains are FUTURE (Phase 6) — DNS verification and SSL aren&apos;t wired up yet.
      </p>

      {domains.length === 0 ? (
        <div className="border border-dashed border-neutral-800 rounded-2xl py-16 flex flex-col items-center text-center">
          <Network size={20} className="text-neutral-600 mb-3" />
          <p className="text-neutral-300 font-medium">No domains yet</p>
          <p className="text-neutral-500 text-sm mt-1">Deploy a website to get its subdomain.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800/80 divide-y divide-neutral-800/80">
          {domains.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{d.hostname}</p>
                <p className="text-xs text-neutral-500">{d.projectName}</p>
              </div>
              <span className="text-xs text-neutral-500">
                {d.isCustom ? "Custom" : "Platform"} · {d.isPrimary ? "Primary" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
