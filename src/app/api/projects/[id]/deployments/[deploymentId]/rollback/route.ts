// IMPLEMENTED (spec section 7: "Allow rollback to a previous successful deployment")
import { NextResponse } from "next/server";
import { projectsCol, deploymentsCol, deploymentLogsCol } from "@/lib/firestore";
import { getSession } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, deploymentId } = await params;
  const projectSnap = await projectsCol().doc(id).get();
  if (!projectSnap.exists || projectSnap.data()!.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (projectSnap.data()!.ownerId !== session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetRef = deploymentsCol(id).doc(deploymentId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }
  const target = targetSnap.data()!;
  if (target.status !== "READY") {
    return NextResponse.json(
      { error: `Can only roll back to a READY deployment (this one is ${target.status}).` },
      { status: 400 }
    );
  }
  if (target.isProduction) {
    return NextResponse.json({ error: "This deployment is already in production." }, { status: 400 });
  }

  const prevProdSnap = await deploymentsCol(id).where("isProduction", "==", true).get();
  await Promise.all(prevProdSnap.docs.map((d) => d.ref.update({ isProduction: false })));
  await targetRef.update({ isProduction: true, isTemporary: false, expiresAt: null });

  await deploymentLogsCol(id, deploymentId).add({
    message: `Rolled back to v${target.version} from the dashboard`,
    level: "info",
    createdAt: new Date().toISOString(),
  });

  const updated = await targetRef.get();
  return NextResponse.json({ deployment: { id: updated.id, ...updated.data() } });
}
