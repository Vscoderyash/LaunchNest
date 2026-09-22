// IMPLEMENTED
// Spec section 18: env vars are encrypted at rest and never returned to the
// client after creation. This route only ever returns keys + metadata.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { projectsCol, envVarsCol } from "@/lib/firestore";
import { encryptSecret } from "@/lib/encryption";

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

async function requireOwnedProject(projectId: string, uid: string) {
  const snap = await projectsCol().doc(projectId).get();
  if (!snap.exists || snap.data()!.deletedAt) return { ok: false, status: 404 as const };
  if (snap.data()!.ownerId !== uid) return { ok: false, status: 403 as const };
  return { ok: true, status: 200 as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const check = await requireOwnedProject(id, session.uid);
  if (!check.ok) {
    return NextResponse.json({ error: check.status === 404 ? "Project not found" : "Forbidden" }, { status: check.status });
  }

  const snap = await envVarsCol(id).orderBy("key", "asc").get();
  const variables = snap.docs.map((d) => ({
    id: d.id,
    key: d.data().key,
    createdAt: d.data().createdAt,
    updatedAt: d.data().updatedAt,
  })); // never encryptedValue

  return NextResponse.json({ variables });
}

const CreateEnvSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10_000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const check = await requireOwnedProject(id, session.uid);
  if (!check.ok) {
    return NextResponse.json({ error: check.status === 404 ? "Project not found" : "Forbidden" }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateEnvSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { key, value } = parsed.data;
  if (!KEY_RE.test(key)) {
    return NextResponse.json(
      { error: "Keys must be UPPER_SNAKE_CASE (letters, numbers, underscores)." },
      { status: 400 }
    );
  }

  let encryptedValue: string;
  try {
    encryptedValue = encryptSecret(value);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Encryption failed." },
      { status: 500 }
    );
  }

  const col = envVarsCol(id);
  const existing = await col.where("key", "==", key).limit(1).get();
  const now = new Date().toISOString();

  let variableId: string;
  if (!existing.empty) {
    variableId = existing.docs[0].id;
    await existing.docs[0].ref.update({ encryptedValue, updatedAt: now });
  } else {
    const ref = await col.add({ key, encryptedValue, createdAt: now, updatedAt: now });
    variableId = ref.id;
  }

  return NextResponse.json({ variable: { id: variableId, key, createdAt: now, updatedAt: now } }, { status: 201 });
}
