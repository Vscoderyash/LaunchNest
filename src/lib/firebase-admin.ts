// IMPLEMENTED
// Server-only. Never import this from a Client Component. Uses a service
// account credential — a real secret, set as FIREBASE_SERVICE_ACCOUNT_KEY
// (the full JSON, as a single-line string) in .env / Vercel env vars.

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

export type ParsedServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * Pure parsing/validation, split out from getAdminApp() so it's unit
 * testable without actually touching firebase-admin's cert()/initializeApp.
 * Throws a specific, actionable Error for the failure modes that actually
 * happen when a person pastes this secret into a web form by hand.
 */
export function parseServiceAccountKey(raw: string | undefined): ParsedServiceAccount {
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Generate one in Firebase Console → " +
        "Project Settings → Service Accounts → Generate new private key, and paste " +
        "the full JSON (as one line) into this env var."
    );
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(raw);
  } catch (err) {
    // A very common paste mistake: wrapping the whole JSON in an extra pair
    // of quotes (treating it like a shell .env line, FOO="...", when
    // pasting into a web form's single value field that doesn't want that).
    // Give a specific, actionable message for that case rather than a bare
    // "not valid JSON" that leaves the person guessing.
    const trimmed = raw.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY looks like it has an extra pair of quotes wrapped " +
          "around the whole JSON (e.g. from pasting it as if it were a .env line). Paste " +
          "just the JSON itself, starting with { and ending with }, no surrounding quotes."
      );
    }
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON (${err instanceof Error ? err.message : "parse error"}). ` +
        "Paste the entire downloaded service-account JSON file's contents, unmodified."
    );
  }

  // JSON.parse can succeed but hand back something that isn't an object —
  // most commonly a *string*, when the whole JSON was wrapped in quotes
  // with its own internal quotes properly escaped (so parsing "succeeds"
  // and just decodes one layer of quoting, same underlying paste mistake
  // as above, but one that doesn't throw).
  if (typeof parsedRaw !== "object" || parsedRaw === null || Array.isArray(parsedRaw)) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY parsed as JSON but isn't a JSON object — likely the " +
        "whole thing got wrapped in an extra layer of quotes (with the inner quotes escaped), " +
        "so it decoded to a plain string instead of {...}. Paste just the JSON object itself."
    );
  }

  const serviceAccount = parsedRaw as Record<string, string>;
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    const missing = ["project_id", "client_email", "private_key"].filter((k) => !serviceAccount[k]);
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_KEY parsed as JSON but is missing required field(s): ${missing.join(", ")}. ` +
        "Make sure you pasted the full file, not a partial copy."
    );
  }

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    // Service account JSON escapes newlines as \n — JSON.parse already
    // converts those to real newlines, so this is a no-op in the normal
    // case and only matters if something upstream double-escaped the value.
    privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
  };
}

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const parsed = parseServiceAccountKey(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  cachedApp = initializeApp({
    credential: cert({
      projectId: parsed.projectId,
      clientEmail: parsed.clientEmail,
      privateKey: parsed.privateKey,
    }),
  });
  return cachedApp;
}

// Lazy accessors, NOT eagerly-evaluated exports: initializing at module load
// would run during 'next build's static analysis, crashing the build if the
// env var isn't present yet at build time (it's only needed at runtime).
export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getDb() {
  return getFirestore(getAdminApp());
}
