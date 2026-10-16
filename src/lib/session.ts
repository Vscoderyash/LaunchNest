// IMPLEMENTED
// Replaces Auth.js's auth(). Reads the __session cookie set by
// /api/auth/session and verifies it against Firebase Admin. Call from any
// Server Component or Route Handler (Node.js runtime — this does NOT work
// in Edge middleware, see middleware.ts for why that only checks for the
// cookie's presence instead of verifying it).

import { cache } from "react";
import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { SESSION_COOKIE_NAME } from "./constants";

export { SESSION_COOKIE_NAME };

export type Session = { uid: string; email: string | null; name: string | null };

// cache(): the dashboard layout and the page both call this in one request —
// verify once, not twice.
export const getSession = cache(async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  // checkRevoked=false: the cookie signature and expiry are verified locally
  // against cached Google keys. `true` makes a live Firebase Auth call on every
  // request (and the layout + page both verify), adding a network round trip to
  // every navigation. Tradeoff: a session revoked server-side stays valid until
  // the cookie expires.
  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, false);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    // Expired or tampered cookie.
    return null;
  }
});
