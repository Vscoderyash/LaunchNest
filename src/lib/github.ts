// IMPLEMENTED
// Thin wrapper around the GitHub REST API for the import flow. Token is
// always passed in from the server (decrypted just-in-time) — never stored
// here, never logged.

const GITHUB_API = "https://api.github.com";

export class GitHubApiError extends Error {}

async function githubFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  return res;
}

export async function verifyGitHubToken(token: string): Promise<{ id: string; login: string }> {
  const res = await githubFetch("/user", token);
  if (!res.ok) {
    throw new GitHubApiError(
      res.status === 401 ? "That token isn't valid." : `GitHub API error (${res.status}).`
    );
  }
  const data = await res.json();
  return { id: String(data.id), login: data.login };
}

export type GitHubRepo = { fullName: string; defaultBranch: string; private: boolean };

export async function listGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const res = await githubFetch("/user/repos?per_page=100&sort=updated", token);
  if (!res.ok) throw new GitHubApiError(`Failed to list repositories (${res.status}).`);
  const data = await res.json();
  return data.map((r: { full_name: string; default_branch: string; private: boolean }) => ({
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    private: r.private,
  }));
}

export async function listGitHubBranches(token: string, repoFullName: string): Promise<string[]> {
  const res = await githubFetch(`/repos/${repoFullName}/branches?per_page=100`, token);
  if (!res.ok) throw new GitHubApiError(`Failed to list branches (${res.status}).`);
  const data = await res.json();
  return data.map((b: { name: string }) => b.name);
}

/** Downloads a repo@branch as a ZIP buffer (GitHub's zipball endpoint). */
export async function downloadGitHubZipball(
  token: string,
  repoFullName: string,
  branch: string
): Promise<Buffer> {
  const res = await githubFetch(`/repos/${repoFullName}/zipball/${branch}`, token);
  if (!res.ok) {
    throw new GitHubApiError(`Failed to download "${repoFullName}@${branch}" (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}
