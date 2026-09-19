// IMPLEMENTED
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReservedSlug, isValidSlug, slugify } from "@/lib/slug";
import { getLimitsForTier } from "@/lib/limits";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(80),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PRIVATE"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      deployments: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Enforce free-plan project limit (spec section 20).
  const limits = getLimitsForTier(user.planTier);
  const currentCount = await prisma.project.count({
    where: { ownerId: user.id, deletedAt: null },
  });
  if (currentCount >= limits.maxProjects) {
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

  // Resolve slug collisions deterministically: name, name-2, name-3, ...
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      visibility,
      ownerId: user.id,
      files: {
        // "Start blank" still needs a deployable artifact — a minimal
        // placeholder page — so Deploy works immediately instead of failing.
        create: [
          {
            path: "index.html",
            content: `<!doctype html>\n<html><head><meta charset="utf-8"><title>${name}</title></head><body style="font-family:system-ui;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>${name} is live on LaunchNest 🚀</p></body></html>\n`,
            size: 0,
          },
        ],
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
