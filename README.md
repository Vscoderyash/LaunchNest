# LaunchNest

Build it. Deploy it. Own the web. — a website-builder/hosting platform:
idea → create/import → build → deploy → live subdomain.

This repo is **Phase 1** of the build order below. It is a real, runnable
Next.js app with a real database and auth — not a landing-page-only mock —
but it is not yet a production multi-tenant host. See "Status" for exactly
what's implemented, mocked, or still future work.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM (**pinned to 5.22.0** — newer `prisma`/`@prisma/client`
  versions trigger an npm arborist bug on install; see Troubleshooting)
- Auth.js v5 (GitHub OAuth + email/password credentials)
- Vitest for unit tests

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY, GitHub OAuth keys
npx prisma migrate dev --name init
npx prisma db seed     # creates demo@launchnest.app / password123
npm run dev
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`. Create a GitHub OAuth
app at github.com/settings/developers with callback URL
`http://localhost:3000/api/auth/callback/github` (this is for *login* only).
GitHub *import* uses a separate personal access token you paste in-app under
"Create Website → Import GitHub" — no extra env var needed for that.

Run tests: `npm test`. Lint: `npm run lint`.

## Status: IMPLEMENTED / MOCKED / FUTURE

**IMPLEMENTED** (real, working, tested against the schema):
- Auth (GitHub OAuth + credentials), registration, session-protected routes
- Full Prisma schema — every model from the product spec (User, Project,
  Deployment, DeploymentLog, ProjectFile, Domain, EnvironmentVariable,
  GitHubConnection, GitHubImport, AnalyticsEvent, Template, Team, TeamMember,
  SubscriptionPlan, UsageRecord)
- Project CRUD with strict ownership checks (a user can never read/edit
  another user's project — enforced server-side on every route, not just hidden in the UI)
- Slug generation, collision resolution, reserved-name blocking
- Free-plan limits (3 projects, storage cap) enforced at creation/upload,
  centralized in `src/lib/limits.ts`
- Deployment history + state machine (QUEUED → BUILDING → READY/FAILED),
  versioning, production/temporary deployment flags, auto subdomain assignment
- **ZIP upload**: validates and extracts a ZIP (`src/lib/zip.ts`), detects
  index.html/framework, blocks path traversal and zip bombs, enforces size
  limits, replaces a project's files, wired into both "Create Website" and
  an "Import Changes" button on the project page
- **Subdomain routing architecture**: `middleware.ts` rewrites
  `<slug>.<BASE_DOMAIN>` requests to `/_sites/<slug>/...`; the route handler
  at `src/app/_sites/[slug]/[[...path]]/route.ts` serves the right file with
  the right content-type
- **Visibility enforcement**: PRIVATE projects 403 anyone but the owner;
  PUBLIC/UNLISTED are viewable by anyone with the link — enforced at the
  serving layer, not just hidden in the UI
- **Deployment rollback**: promote any previous READY deployment back to
  production; the swap is transactional (old production deployment is
  demoted in the same transaction)
- **Environment variables**: AES-256-GCM encrypted at rest
  (`src/lib/encryption.ts`); the API only ever returns keys, never values,
  once created — matching the spec's "never display secret values after
  initial creation" requirement
- **GitHub import**: connect via a personal access token (see note below on
  why this replaces full OAuth-connect), list repos/branches, download a
  repo@branch as a zipball and run it through the *same* ZIP validation
  pipeline as manual upload — same index.html requirement, same path-safety
  checks, same framework detection
- **Templates**: a real marketplace listing (2 seeded templates with actual
  multi-file content) with a working "use this template" flow that creates
  a project and copies the template's files into it
- **Editor**: file tree, textarea editor, and a genuinely live preview pane
  that re-renders client-side as you type (no server round-trip needed to
  preview) — see the "Editor" section below for exactly how and its limits
- Real project Settings tab (rename, change visibility, delete) — previously
  a phase-gated placeholder with no actual content behind it
- Dashboard: overview stats, website list, empty states, create-website flow
- Path-traversal protection for project file paths
- 24 unit tests (slug validation, path safety, plan limits, ZIP extraction, encryption)

**MOCKED** (a real code path exists, but it fakes the hard infrastructure part):
- The "build" step in deployment creation. For a STATIC project it just
  validates files exist and marks the deployment READY instantly — there is
  no real build container. See `src/app/api/projects/[id]/deployments/route.ts`
  for exactly what's mocked and why.
- File storage: text files (html/css/js/json/svg/etc.) are stored as text in
  Postgres (`ProjectFile.content`) rather than an object store. Binary
  assets (images, fonts) from a ZIP are recorded as metadata only — their
  bytes aren't persisted yet, and requesting one from `/_sites/...` returns
  a 501 explaining why. Needs S3-compatible storage (Phase 2+ follow-up).
- Real wildcard subdomains: the routing *architecture* is implemented and
  testable (see "Subdomain routing" below), but `*.launchnest.app` on the
  live Vercel deployment needs a custom domain with wildcard DNS added in
  Vercel's dashboard — that's a DNS/infra step, not code, and hasn't been
  done yet. Until then, every project is reachable at `/_sites/<slug>`.

**FUTURE** (schema/UI placeholders exist; no logic behind them yet):
- AI website generation, analytics ingestion, custom domains + DNS/SSL,
  teams, billing, a public "explore" page for PUBLIC projects
  (UNLISTED-vs-PUBLIC listing visibility is enforced at access time; there's
  just no directory to omit UNLISTED projects *from* yet), Monaco-based
  editing (current editor is a plain textarea by design — spec section 13
  explicitly allows deferring this), multi-file live preview (see Editor note)
- Cancelling an in-flight (QUEUED/BUILDING) deployment — moot for now since
  the mocked build completes synchronously and instantly, but the
  CANCELLED state exists in the schema for when real async builds land.
- Real OAuth "Connect GitHub" flow and auto-deploy-on-push webhooks — see
  the GitHub import note below for what shipped instead and why.

## GitHub import: PAT instead of OAuth-connect

The spec calls for a "Connect GitHub" OAuth flow. I implemented import via a
**personal access token** instead, and want to be upfront about why rather
than let it look like an oversight: Auth.js (NextAuth v5) already uses
GitHub OAuth for *login*. Getting a *second*, `repo`-scoped GitHub token
linked to an already-logged-in user runs into NextAuth's account-linking
rules — by default it won't attach a second OAuth account to an existing
user without either fighting the Prisma adapter's unique constraints or
enabling `allowDangerousEmailAccountLinking` (which has real security
implications for an auth system, not something to flip on quietly to make
an unrelated feature simpler). A PAT-based connect has the same security
properties the spec asks for — the token is encrypted at rest
(`GitHubConnection.encryptedAccessToken`, same AES-256-GCM as env vars) and
never sent back to the client — it's just a simpler flow than a real OAuth
handshake. Swapping in true OAuth-connect later is a contained change: same
`GitHubConnection` table, same `src/lib/github.ts` helpers, just a different
route to populate `encryptedAccessToken`.

## Editor: what "live preview" actually means here

The editor's preview pane doesn't ask the server anything — it builds the
preview entirely in the browser by inlining `style.css` into `<head>` and
`script.js` before `</body>` of whatever `index.html` currently says (using
the in-progress draft, not just the last save). That's genuinely live and
fast, but it's a real limitation, not a corner cut silently: a file that
references *other* files via `<link>` or `<script src="...">` (anything
beyond the conventional three) won't resolve inside the sandboxed
`srcDoc`, since there's no server backing that URL inside the iframe.
Proper multi-file preview needs blob URLs or a service worker intercepting
requests — noted as FUTURE rather than attempted half-way.

## Subdomain routing

Locally: set `BASE_DOMAIN=localhost:3000` in `.env`, run `npm run dev`, and
visit `http://<project-slug>.localhost:3000` — modern browsers resolve
`*.localhost` automatically, no `/etc/hosts` edit needed. The middleware
rewrites that request to `/_sites/<project-slug>/...` internally.

In production, this needs a real domain with wildcard DNS
(`*.yourdomain.com` → your Vercel project) added via Vercel's dashboard, then
`BASE_DOMAIN=yourdomain.com` in your env vars. Until that's set up, every
project is still reachable directly at `https://your-app.vercel.app/_sites/<slug>`.

## Why the "build" and "hosting" pieces are mocked, not real

Per the product spec's own security requirement: **never execute uploaded
code inside the main app process.** Building this for real needs infrastructure
this repo alone can't provide:
- Isolated build containers (e.g. Firecracker/gVisor/Docker workers) that take
  project files and produce static output, with resource + time limits
- S3-compatible object storage for build artifacts
- An edge router/reverse proxy that maps `hostname → project → active
  deployment → files` (e.g. a Next.js middleware in front of a CDN, or a
  dedicated Caddy/Nginx layer reading from the `Domain` table)
- A queue (e.g. BullMQ/SQS) so `QUEUED` deployments are processed by workers,
  not by the request handler that created them

Phase 1 defers all of this and mocks the build as "instant success" for
static files so the rest of the product (dashboard, ownership, plan limits,
deployment history, rollback) can be built and tested against a realistic
data model now, without pretending fake infra is production hosting.

## Project structure

```
src/
  app/            routes (App Router) — (dashboard) is an auth-gated route group
  components/     UI components (dashboard/, icons/, ui/)
  lib/            auth.ts, prisma.ts, limits.ts, slug.ts + tests
prisma/
  schema.prisma   full data model
  seed.ts         demo user/project/deployment/templates
```

## Build order (unchanged from the product spec)

1. **Auth, database, dashboard, project creation** — done
2. **ZIP upload, static deployment, subdomains, public/private** — done
3. **Deployment history, logs, rollback, environment variables** — done
4. **GitHub integration, templates, editor** — done (this update; GitHub via
   PAT rather than OAuth-connect, editor is textarea-based, see notes above)
5. AI website generation
6. Analytics, custom domains, temporary deployments (temporary deployments partially done)
7. Teams, billing, advanced infrastructure

## Troubleshooting

- **`prisma generate` fails to fetch a checksum/engine file**: your network
  can't reach `binaries.prisma.sh`. This also affects the sandboxed
  environment this repo was scaffolded in — locally, with normal internet
  access, `npm install` + `npx prisma generate` should work without any flags.
- **npm install throws `Cannot read properties of null (reading 'edgesOut')`**:
  this is a known npm `arborist` bug triggered by `prisma@latest`. Installing
  `prisma@5.22.0` and `@prisma/client@5.22.0` explicitly (already pinned in
  `package.json`) avoids it.
