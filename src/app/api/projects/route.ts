// IMPLEMENTED
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  getUser,
  projectsCol,
  projectFilesCol,
  deploymentsCol,
  createProjectWithUniqueSlug,
  withId,
  type ProjectDoc,
  type DeploymentDoc,
} from "@/lib/firestore";
import { isReservedSlug, isValidSlug, slugify } from "@/lib/slug";
import { getLimitsForTier } from "@/lib/limits";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(80),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PRIVATE"),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No .orderBy() here: see the identical note in dashboard pages — two
  // equality filters plus orderBy on a third field needs a Firestore
  // composite index that doesn't exist on a fresh project. Sort in-memory.
  const snap = await projectsCol()
    .where("ownerId", "==", session.uid)
    .where("deletedAt", "==", null)
    .get();

  const projects = await Promise.all(
    snap.docs.map(async (doc) => {
      const latestSnap = await deploymentsCol(doc.id).orderBy("version", "desc").limit(1).get();
      const deployments = latestSnap.docs.map((d) => withId<DeploymentDoc>(d));
      return { ...withId<ProjectDoc>(doc), deployments };
    })
  );
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await getUser(session.uid);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Enforce free-plan project limit (spec section 20).
  const limits = getLimitsForTier(user.planTier);
  const countSnap = await projectsCol()
    .where("ownerId", "==", session.uid)
    .where("deletedAt", "==", null)
    .count()
    .get();
  if (countSnap.data().count >= limits.maxProjects) {
    return NextResponse.json(
      {
        error: `You've reached your ${user.planTier.toLowerCase()} plan website limit (${limits.maxProjects}). Upgrade to create more.`,
      },
      { status: 403 }
    );
  }

  const { name, visibility } = parsed.data;
  const baseSlug = slugify(name);

  if (!isValidSlug(baseSlug)) {
    return NextResponse.json(
      { error: "Project name must produce a valid subdomain (letters, numbers, hyphens)." },
      { status: 400 }
    );
  }
  if (isReservedSlug(baseSlug)) {
    return NextResponse.json(
      { error: `"${baseSlug}" is a reserved name. Choose a different project name.` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { id, slug } = await createProjectWithUniqueSlug(baseSlug, {
    name,
    visibility,
    framework: "STATIC",
    ownerId: session.uid,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  // "Start blank" still needs a deployable artifact — a minimal placeholder
  // page — so Deploy works immediately instead of failing.
  const placeholderHtml = `<!doctype html>\n<html><head><meta charset="utf-8"><title>${name}</title></head><body style="font-family:system-ui;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>${name} is live on LaunchNest 🚀</p></body></html>\n`;
  await projectFilesCol(id).add({
    path: "index.html",
    content: placeholderHtml,
    size: Buffer.byteLength(placeholderHtml, "utf-8"),
    updatedAt: now,
  });

  return NextResponse.json({ project: { id, slug, name, visibility } }, { status: 201 });
}
