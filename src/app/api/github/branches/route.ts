import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { githubConnectionsCol } from "@/lib/firestore";
import { decryptSecret } from "@/lib/encryption";
import { listGitHubBranches, GitHubApiError } from "@/lib/github";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "Missing repo query param." }, { status: 400 });

  const snap = await githubConnectionsCol().doc(session.uid).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "GitHub isn't connected yet." }, { status: 400 });
  }

  try {
    const token = decryptSecret(snap.data()!.encryptedAccessToken);
    const branches = await listGitHubBranches(token, repo);
    return NextResponse.json({ branches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof GitHubApiError ? err.message : "Failed to list branches." },
      { status: 502 }
    );
  }
}
