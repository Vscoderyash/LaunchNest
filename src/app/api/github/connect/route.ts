// IMPLEMENTED (with a documented shortcut — see README "GitHub import").
// Token is verified against GitHub, encrypted, and stored. It is never
// returned to the client again (GET only reports whether a connection
// exists + the linked username, never the token).

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";
import { verifyGitHubToken, GitHubApiError } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const connection = await prisma.gitHubConnection.findUnique({
    where: { userId: session.user.id },
    select: { githubUsername: true, createdAt: true },
  });
  return NextResponse.json({ connection });
}

const ConnectSchema = z.object({ token: z.string().min(10).max(255) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a GitHub personal access token." }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGitHubToken(parsed.data.token);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof GitHubApiError ? err.message : "Could not verify token." },
      { status: 400 }
    );
  }

  const encryptedAccessToken = encryptSecret(parsed.data.token);

  const connection = await prisma.gitHubConnection.upsert({
    where: { userId: session.user.id },
    update: { githubUserId: identity.id, githubUsername: identity.login, encryptedAccessToken },
    create: {
      userId: session.user.id,
      githubUserId: identity.id,
      githubUsername: identity.login,
      encryptedAccessToken,
    },
    select: { githubUsername: true },
  });

  return NextResponse.json({ connection });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.gitHubConnection.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ success: true });
}
