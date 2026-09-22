import { getSession } from "@/lib/session";
import { projectsCol, deploymentsCol, withId, type ProjectDoc, type DeploymentDoc } from "@/lib/firestore";
import { EmptyWebsitesState } from "@/components/dashboard/empty-state";
import { WebsiteCard } from "@/components/dashboard/website-card";

export default async function WebsitesPage() {
  const session = await getSession();
  const snap = await projectsCol()
    .where("ownerId", "==", session!.uid)
    .where("deletedAt", "==", null)
    .orderBy("updatedAt", "desc")
    .get();

  const projects = await Promise.all(
    snap.docs.map(async (doc) => {
      const latestSnap = await deploymentsCol(doc.id).orderBy("version", "desc").limit(1).get();
      const deployments = latestSnap.docs.map((d) => withId<DeploymentDoc>(d));
      return { ...withId<ProjectDoc>(doc), deployments };
    })
  );

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
