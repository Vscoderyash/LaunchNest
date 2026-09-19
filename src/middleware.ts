// IMPLEMENTED: subdomain -> project routing architecture (spec section 8),
// plus the existing dashboard auth guard.
//
// Real wildcard subdomains (*.launchnest.app) require a custom domain with
// wildcard DNS configured on the host (e.g. Vercel "Add Domain" -> *.yourdomain).
// That's a deployment/DNS step outside this repo, not more code. Until then:
//   - Locally: set BASE_DOMAIN=localhost:3000 in .env and visit
//     http://<project-slug>.localhost:3000 — modern browsers resolve
//     *.localhost without any /etc/hosts changes.
//   - Anywhere: visit /_sites/<project-slug> directly, which is what this
//     middleware rewrites subdomain requests to internally.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const BASE_DOMAIN = process.env.BASE_DOMAIN || "localhost:3000";
const RESERVED_HOSTS = new Set(["www", "app", "dashboard", "api"]);

export default auth((req) => {
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

  if (pathname.startsWith("/dashboard") && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next|_sites|favicon.ico).*)"],
};
