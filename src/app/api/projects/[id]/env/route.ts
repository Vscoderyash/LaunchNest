// IMPLEMENTED
// Spec section 18: env vars are encrypted at rest and never returned to the
// client after creation. This route only ever returns keys + metadata.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;

async function requireOwnedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) return { project: null, status: 404 as const };
  if (project.ownerId !== userId) return { project: null, status: 403 as const };
  return { project, status: 200 as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
  }

  const vars = await prisma.environmentVariable.findMany({
    where: { projectId: project.id },
    select: { id: true, key: true, createdAt: true, updatedAt: true }, // never encryptedValue
    orderBy: { key: "asc" },
  });

  return NextResponse.json({ variables: vars });
}

const CreateEnvSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10_000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { project, status } = await requireOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: status === 404 ? "Project not found" : "Forbidden" }, { status });
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

  const variable = await prisma.environmentVariable.upsert({
    where: { projectId_key: { projectId: project.id, key } },
    update: { encryptedValue },
    create: { projectId: project.id, key, encryptedValue },
    select: { id: true, key: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ variable }, { status: 201 });
}
