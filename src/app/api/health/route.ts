// Diagnostic endpoint. Reports which server env vars exist and, step by
// step, whether Firebase Admin loads, Auth works, and Firestore is reachable.
// Booleans / coarse codes only — never env values or raw error text
// (JSON.parse errors can echo fragments of the input).
//
//   /api/health?skip=admin   -> env + runtime info only (never touches Firebase)

import { NextResponse } from "next/server";
import { auditEnv } from "@/lib/env-audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function coarse(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY")) return msg.split(" (")[0].slice(0, 200);
  const grpc = msg.match(/^\d+ [A-Z_]+/)?.[0]; // e.g. "5 NOT_FOUND", "7 PERMISSION_DENIED"
  if (grpc) return grpc;
  const code = (err as { code?: string })?.code;
  return typeof code === "string" ? code.slice(0, 80) : (err instanceof Error ? err.name : "error");
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}-timeout`)), ms)),
  ]);
}

export async function GET(req: Request) {
  const env = auditEnv(process.env);
  const runtime = { node: process.version, region: process.env.VERCEL_REGION ?? null };

  if (new URL(req.url).searchParams.get("skip") === "admin") {
    return NextResponse.json({ ok: env.missingRequired.length === 0, skipped: "admin", runtime, env });
  }

  const steps: Record<string, string> = {};
  const ms: Record<string, number> = {};
  const time = async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t = performance.now();
    try {
      return await fn();
    } finally {
      ms[name] = Math.round(performance.now() - t);
    }
  };

  let mod: typeof import("@/lib/firebase-admin") | null = null;
  try {
    mod = await time("import", () => import("@/lib/firebase-admin"));
    steps.import = "ok";
  } catch (err) {
    steps.import = `fail: ${err instanceof Error ? err.message.slice(0, 300) : "error"}`; // module-load errors never contain env values
  }

  if (mod) {
    try {
      await time("adminInit", async () => mod!.getAdminAuth());
      steps.adminInit = "ok";
    } catch (err) {
      steps.adminInit = `fail: ${coarse(err)}`;
    }
    if (steps.adminInit === "ok") {
      try {
        await time("authApi", () => withTimeout(mod!.getAdminAuth().listUsers(1), 8000, "auth"));
        steps.authApi = "ok";
      } catch (err) {
        steps.authApi = `fail: ${coarse(err)}`;
      }
      // Two reads: the first includes connection setup (cold), the second is
      // the steady-state latency between this function's region and Firestore.
      try {
        await time("firestoreFirstRead", () => withTimeout(mod!.getDb().collection("_health").limit(1).get(), 8000, "firestore"));
        await time("firestoreSecondRead", () => withTimeout(mod!.getDb().collection("_health").limit(1).get(), 8000, "firestore"));
        steps.firestore = "ok";
      } catch (err) {
        steps.firestore = `fail: ${coarse(err)}`;
      }
    }
  }

  const ok = Object.values(steps).every((v) => v === "ok") && env.missingRequired.length === 0;
  return NextResponse.json({ ok, steps, timingsMs: ms, runtime, env }, { status: ok ? 200 : 500 });
}
