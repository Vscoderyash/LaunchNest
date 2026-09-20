import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { listGitHubBranches, GitHubApiError } from "@/lib/github";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ error: "Missing repo query param." }, { status: 400 });
  }

  const connection = await prisma.gitHubConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) {
    return NextResponse.json({ error: "GitHub isn't connected yet." }, { status: 400 });
  }

  try {
    const token = decryptSecret(connection.encryptedAccessToken);
    const branches = await listGitHubBranches(token, repo);
    return NextResponse.json({ branches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof GitHubApiError ? err.message : "Failed to list branches." },
      { status: 502 }
    );
  }
}
