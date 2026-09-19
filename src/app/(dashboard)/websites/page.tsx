import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyWebsitesState } from "@/components/dashboard/empty-state";
import { WebsiteCard } from "@/components/dashboard/website-card";

export default async function WebsitesPage() {
  const session = await auth();
  const projects = await prisma.project.findMany({
    where: { ownerId: session!.user!.id as string, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { deployments: { orderBy: { version: "desc" }, take: 1 } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Websites</h1>
      {projects.length === 0 ? (
        <EmptyWebsitesState />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <WebsiteCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
