// IMPLEMENTED
// Firestore data layer. Design notes (see README "Firestore data model"
// for the full writeup of why each of these differs from the old Prisma schema):
//
//   users/{uid}
//   projectSlugs/{slug} -> { projectId }   (uniqueness, since Firestore has no unique constraints)
//   projects/{projectId}
//     files/{autoId}       -> { path, content, size, updatedAt }
//     deployments/{autoId} -> { version, status, ... }
//       logs/{autoId}      -> { message, level, createdAt }
//     envVars/{autoId}     -> { key, encryptedValue, createdAt, updatedAt }
//     domains/{autoId}     -> { hostname, isPrimary, ... }
//   githubConnections/{uid}
//   templates/{autoId}

import { getDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export type PlanTier = "FREE" | "PRO" | "TEAM";
export type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
export type Framework = "STATIC" | "VITE_REACT" | "NEXTJS" | "UNKNOWN";
export type DeploymentStatus = "QUEUED" | "BUILDING" | "READY" | "FAILED" | "CANCELLED";

export type UserDoc = {
  email: string | null;
  name: string | null;
  planTier: PlanTier;
  createdAt: string;
};

export type ProjectDoc = {
  name: string;
  slug: string;
  visibility: Visibility;
  framework: Framework;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ProjectFileDoc = {
  path: string;
  content: string | null;
  size: number;
  updatedAt: string;
};

export type DeploymentDoc = {
  version: number;
  status: DeploymentStatus;
  source: "ZIP_UPLOAD" | "GITHUB_IMPORT" | "AI_GENERATED" | "TEMPLATE" | "EDITOR";
  isProduction: boolean;
  isTemporary: boolean;
  expiresAt: string | null;
  buildStartedAt: string | null;
  buildFinishedAt: string | null;
  buildDurationMs: number | null;
  createdAt: string;
};

export type DomainDoc = {
  hostname: string;
  isPrimary: boolean;
  isCustom: boolean;
  verified: boolean;
  createdAt: string;
};

export type TemplateDoc = {
  name: string;
  description: string;
  category: string;
  framework: Framework;
  authorName: string;
  tags: string[];
  filesJson: Record<string, string>;
};

export type EnvVarDoc = {
  key: string;
  encryptedValue: string;
  createdAt: string;
  updatedAt: string;
};

export type GitHubConnectionDoc = {
  githubUserId: string;
  githubUsername: string;
  encryptedAccessToken: string;
  createdAt: string;
};

/**
 * Spreading a bare-index-signature type (Firestore's DocumentData) into an
 * object literal loses the index signature in TS's inferred type — this
 * makes that explicit instead of relying on unreliable inference at every
 * call site. Assumes the document exists (use on QueryDocumentSnapshot, or
 * a DocumentSnapshot you've already null-checked).
 */
export function withId<T>(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot
): { id: string } & T {
  return { id: doc.id, ...(doc.data() as T) };
}

export function usersCol() {
  return getDb().collection("users");
}

export function projectSlugsCol() {
  return getDb().collection("projectSlugs");
}

export function projectsCol() {
  return getDb().collection("projects");
}

export function projectFilesCol(projectId: string) {
  return projectsCol().doc(projectId).collection("files");
}

export function deploymentsCol(projectId: string) {
  return projectsCol().doc(projectId).collection("deployments");
}

export function deploymentLogsCol(projectId: string, deploymentId: string) {
  return deploymentsCol(projectId).doc(deploymentId).collection("logs");
}

export function envVarsCol(projectId: string) {
  return projectsCol().doc(projectId).collection("envVars");
}

export function domainsCol(projectId: string) {
  return projectsCol().doc(projectId).collection("domains");
}

export function githubConnectionsCol() {
  return getDb().collection("githubConnections");
}

export function templatesCol() {
  return getDb().collection("templates");
}

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(uid).get();
  return snap.exists ? (snap.data() as UserDoc) : null;
}

/**
 * Atomically reserves a slug and creates the project doc, or throws if the
 * slug is already taken. Mirrors what Prisma's `slug String @unique` gave
 * us for free — Firestore needs an explicit transaction across two
 * collections (projectSlugs as the uniqueness ledger, projects as the data).
 */
export async function createProjectWithUniqueSlug(
  baseSlug: string,
  data: Omit<ProjectDoc, "slug">
): Promise<{ id: string; slug: string }> {
  const db = getDb();
  let slug = baseSlug;
  let suffix = 2;

  for (let attempt = 0; attempt < 50; attempt++) {
    const projectRef = projectsCol().doc();
    const slugRef = projectSlugsCol().doc(slug);

    try {
      await db.runTransaction(async (tx) => {
        const slugSnap = await tx.get(slugRef);
        if (slugSnap.exists) {
          throw new Error("SLUG_TAKEN");
        }
        tx.set(slugRef, { projectId: projectRef.id });
        tx.set(projectRef, { ...data, slug });
      });
      return { id: projectRef.id, slug };
    } catch (err) {
      if (err instanceof Error && err.message === "SLUG_TAKEN") {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not find an available slug after 50 attempts.");
}

export async function getProjectBySlug(slug: string) {
  const slugDoc = await projectSlugsCol().doc(slug).get();
  if (!slugDoc.exists) return null;
  const projectId = slugDoc.data()!.projectId as string;
  const projectDoc = await projectsCol().doc(projectId).get();
  if (!projectDoc.exists) return null;
  return { id: projectDoc.id, ...(projectDoc.data() as ProjectDoc) };
}

export { FieldValue };
