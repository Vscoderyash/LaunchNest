import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Network } from "lucide-react";

export default async function DomainsPage() {
  const session = await auth();
  const domains = await prisma.domain.findMany({
    where: { project: { ownerId: session!.user!.id as string } },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });

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
                <p className="text-xs text-neutral-500">{d.project.name}</p>
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
