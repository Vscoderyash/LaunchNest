// Diagnostic endpoint: reports which server config is present and whether
// the Firebase Admin SDK can actually initialise and reach Firestore.
// Returns booleans and a coarse stage name only — never env var values,
// and never raw error text (JSON.parse errors can echo fragments of the input).

import { NextResponse } from "next/server";
import { getAdminAuth, getDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    FIREBASE_SERVICE_ACCOUNT_KEY: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
    ENCRYPTION_KEY: Boolean(process.env.ENCRYPTION_KEY),
    NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    AI_PROVIDER_API_KEY: Boolean(process.env.AI_PROVIDER_API_KEY),
  };

  let stage: "admin-init" | "firestore" | "ok" = "admin-init";
  let detail: string | null = null;
  try {
    getAdminAuth();
    stage = "firestore";
    await getDb().collection("_health").limit(1).get();
    stage = "ok";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // Keep only our own config-error prefix or Firestore/gRPC error codes.
    detail = msg.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY")
      ? msg.split(" (")[0].slice(0, 200)
      : (msg.match(/^\d+ [A-Z_]+/)?.[0] ?? "error");
  }

  return NextResponse.json({ ok: stage === "ok", stage, detail, env }, { status: stage === "ok" ? 200 : 500 });
}
