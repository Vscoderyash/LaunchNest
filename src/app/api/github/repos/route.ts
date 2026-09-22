import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { githubConnectionsCol } from "@/lib/firestore";
import { decryptSecret } from "@/lib/encryption";
import { listGitHubRepos, GitHubApiError } from "@/lib/github";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await githubConnectionsCol().doc(session.uid).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "GitHub isn't connected yet." }, { status: 400 });
  }

  try {
    const token = decryptSecret(snap.data()!.encryptedAccessToken);
    const repos = await listGitHubRepos(token);
    return NextResponse.json({ repos });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof GitHubApiError ? err.message : "Failed to list repositories." },
      { status: 502 }
    );
  }
}
