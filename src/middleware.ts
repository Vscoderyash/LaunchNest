// IMPLEMENTED: subdomain -> project routing (spec section 8), plus a
// lightweight dashboard auth guard.
//
// IMPORTANT: this middleware runs on the Edge runtime, which cannot run
// Firebase Admin SDK (it needs Node.js APIs). So this only checks whether
// the session cookie *exists* — it does NOT verify it. Real verification
// happens in every Server Component/Route Handler via getSession()
// (src/lib/session.ts), which does run in the Node.js runtime. That's the
// actual security boundary; this middleware redirect is a UX nicety (skip
// rendering the dashboard shell just to redirect) than the enforcement.
//
// Real wildcard subdomains (*.launchnest.app) need a custom domain with
// wildcard DNS configured on the host — see README "Subdomain routing".

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const BASE_DOMAIN = process.env.BASE_DOMAIN || "localhost:3000";
const RESERVED_HOSTS = new Set(["www", "app", "dashboard", "api"]);

export default function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname } = req.nextUrl;

  if (host.endsWith(`.${BASE_DOMAIN}`) && !pathname.startsWith("/_sites")) {
    const subdomain = host.slice(0, -(`.${BASE_DOMAIN}`.length));
    if (subdomain && !RESERVED_HOSTS.has(subdomain)) {
      const url = req.nextUrl.clone();
      url.pathname = `/_sites/${subdomain}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (pathname.startsWith("/dashboard") && !req.cookies.get(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|_sites|favicon.ico).*)"],
};
