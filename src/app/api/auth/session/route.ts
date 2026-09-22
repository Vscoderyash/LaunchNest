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

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(parsed.data.idToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const sessionCookie = await getAdminAuth().createSessionCookie(parsed.data.idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  // Bootstrap the Firestore user doc on first sign-in (upsert, not overwrite,
  // so we don't clobber planTier on every login).
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
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
