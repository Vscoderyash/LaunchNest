import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { listGitHubRepos, GitHubApiError } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.gitHubConnection.findUnique({ where: { userId: session.user.id } });
  if (!connection) {
    return NextResponse.json({ error: "GitHub isn't connected yet." }, { status: 400 });
  }

  try {
    const token = decryptSecret(connection.encryptedAccessToken);
    const repos = await listGitHubRepos(token);
    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof GitHubApiError ? err.message : "Failed to list repositories." },
      { status: 502 }
    );
  }
}
