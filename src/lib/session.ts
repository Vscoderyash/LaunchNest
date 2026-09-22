// IMPLEMENTED
// Replaces Auth.js's auth(). Reads the __session cookie set by
// /api/auth/session and verifies it against Firebase Admin. Call from any
// Server Component or Route Handler (Node.js runtime — this does NOT work
// in Edge middleware, see middleware.ts for why that only checks for the
// cookie's presence instead of verifying it).

import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { SESSION_COOKIE_NAME } from "./constants";

export { SESSION_COOKIE_NAME };

export type Session = { uid: string; email: string | null; name: string | null };

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    // Expired, revoked, or tampered cookie.
    return null;
  }
}
