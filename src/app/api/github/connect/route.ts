// IMPLEMENTED (with a documented shortcut — see README "GitHub import").
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { githubConnectionsCol } from "@/lib/firestore";
import { encryptSecret } from "@/lib/encryption";
import { verifyGitHubToken, GitHubApiError } from "@/lib/github";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await githubConnectionsCol().doc(session.uid).get();
  if (!snap.exists) return NextResponse.json({ connection: null });
  return NextResponse.json({
    connection: { githubUsername: snap.data()!.githubUsername, createdAt: snap.data()!.createdAt },
  });
}

const ConnectSchema = z.object({ token: z.string().min(10).max(255) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  await githubConnectionsCol().doc(session.uid).set({
    githubUserId: identity.id,
    githubUsername: identity.login,
    encryptedAccessToken,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ connection: { githubUsername: identity.login } });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await githubConnectionsCol().doc(session.uid).delete();
  return NextResponse.json({ success: true });
}
