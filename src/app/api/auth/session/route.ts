// IMPLEMENTED
// POST: client sends a fresh Firebase ID token (from signInWith*), we verify
// it, mint a session cookie via Admin SDK, and set it httpOnly. Also
// bootstraps the Firestore users/{uid} doc on first sign-in (mirrors what
// the old Prisma User row + UsageRecord used to do at registration).
// DELETE: clears the cookie (logout).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth, getDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const SessionSchema = z.object({ idToken: z.string().min(10) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  // getAdminAuth() throws synchronously if FIREBASE_SERVICE_ACCOUNT_KEY is
  // missing/malformed — isolate that from token verification so a server
  // configuration problem doesn't get misreported as "invalid token".
  let adminAuth;
  try {
    adminAuth = getAdminAuth();
  } catch (err) {
    console.error("Firebase Admin init failed:", err);
    return NextResponse.json(
      { error: `Server auth configuration error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
  } catch (err) {
    console.error("verifyIdToken failed:", err);
    return NextResponse.json(
      { error: `Invalid or expired token: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 401 }
    );
  }

  try {
    const sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    // Bootstrap the Firestore user doc on first sign-in (upsert, not
    // overwrite, so we don't clobber planTier on every login).
    const userRef = getDb().collection("users").doc(decoded.uid);
    const existing = await userRef.get();
    if (!existing.exists) {
      await userRef.set({
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        planTier: "FREE",
        createdAt: new Date().toISOString(),
      });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS / 1000,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json(
      { error: `Failed to create session: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
