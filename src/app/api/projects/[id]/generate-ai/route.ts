// IMPLEMENTED (spec section 12)
// Generates a static site via src/lib/ai.ts and replaces the project's
// files with it, same storage-limit and Firestore-size-cap handling as
// ZIP upload/GitHub import.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getUser, projectsCol, projectFilesCol } from "@/lib/firestore";
import { getLimitsForTier } from "@/lib/limits";
import { generateWebsiteFiles, AiGenerationError } from "@/lib/ai";
import { MAX_FIRESTORE_TEXT_BYTES } from "@/lib/zip";

const GenerateSchema = z.object({
  prompt: z.string().min(3).max(2000),
  style: z.string().max(200).optional(),
  colorPreference: z.string().max(200).optional(),
  websiteType: z.string().max(200).optional(),
  darkMode: z.boolean().optional(),
  animationLevel: z.enum(["none", "subtle", "playful"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectSnap = await projectsCol().doc(id).get();
  if (!projectSnap.exists || projectSnap.data()!.deletedAt) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (projectSnap.data()!.ownerId !== session.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  let generated;
  try {
    generated = await generateWebsiteFiles(parsed.data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof AiGenerationError ? err.message : "AI generation failed." },
      { status: 502 }
    );
  }

  // Same Firestore document-size cap as ZIP upload/GitHub import — a
  // generated file that's somehow enormous shouldn't crash the write.
  const warnings: string[] = [];
  const entries = Object.entries(generated).map(([path, content]) => {
    const size = Buffer.byteLength(content, "utf-8");
    if (size > MAX_FIRESTORE_TEXT_BYTES) {
      warnings.push(`"${path}" was too large to store (${(size / 1024).toFixed(0)} KB) and was skipped.`);
      return null;
    }
    return { path, content, size };
  }).filter((f): f is { path: string; content: string; size: number } => f !== null);

  if (!entries.some((f) => f.path === "index.html")) {
    return NextResponse.json({ error: "Generation failed: no usable index.html was produced." }, { status: 502 });
  }

  // Enforce free-plan storage limit — same approach as ZIP upload.
  const user = await getUser(session.uid);
  const limits = getLimitsForTier(user!.planTier);
  const otherProjectsSnap = await projectsCol()
    .where("ownerId", "==", session.uid)
    .where("deletedAt", "==", null)
    .get();
  let otherBytes = 0;
  for (const doc of otherProjectsSnap.docs) {
    if (doc.id === id) continue;
    const filesSnap = await projectFilesCol(doc.id).get();
    otherBytes += filesSnap.docs.reduce((sum, f) => sum + (f.data().size ?? 0), 0);
  }
  const newTotalBytes = entries.reduce((sum, f) => sum + f.size, 0);
  const projectedMb = (otherBytes + newTotalBytes) / (1024 * 1024);
  if (projectedMb > limits.maxStorageMb) {
    return NextResponse.json(
      { error: `This would exceed your ${user!.planTier.toLowerCase()} plan storage limit (${limits.maxStorageMb} MB).` },
      { status: 413 }
    );
  }

  const filesRef = projectFilesCol(id);
  const existing = await filesRef.get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  const now = new Date().toISOString();
  await Promise.all(
    entries.map((f) => filesRef.add({ path: f.path, content: f.content, size: f.size, updatedAt: now }))
  );
  await projectsCol().doc(id).update({ framework: "STATIC", updatedAt: now });

  return NextResponse.json({ fileCount: entries.length, warnings });
}
