// IMPLEMENTED
// Server-only. Never import this from a Client Component. Uses a service
// account credential — a real secret, set as FIREBASE_SERVICE_ACCOUNT_KEY
// (the full JSON, as a single-line string) in .env / Vercel env vars.

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Generate one in Firebase Console → " +
        "Project Settings → Service Accounts → Generate new private key, and paste " +
        "the full JSON (as one line) into this env var."
    );
  }

  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      // Service account JSON escapes newlines as \n literally — restore them.
      privateKey: serviceAccount.private_key?.replace(/\\n/g, "\n"),
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
