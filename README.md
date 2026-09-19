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
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, GitHub OAuth keys
npx prisma migrate dev --name init
npx prisma db seed     # creates demo@launchnest.app / password123
npm run dev
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`. Create a GitHub OAuth
app at github.com/settings/developers with callback URL
`http://localhost:3000/api/auth/callback/github`.

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
- Dashboard: overview stats, website list, empty states, create-website flow
- Path-traversal protection for project file paths
- 21 unit tests (slug validation, path safety, plan limits, ZIP extraction)

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
- GitHub import, AI website generation, template marketplace, the code
  editor, analytics ingestion, custom domains + DNS/SSL, teams, billing,
  a public "explore" page for PUBLIC projects (UNLISTED-vs-PUBLIC listing
  visibility is enforced at access time; there's just no directory to omit
  UNLISTED projects *from* yet). Each has a disabled UI entry point tagged
  with the phase it belongs to (see the Build Order below).

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
2. **ZIP upload, static deployment, subdomains, public/private** — done (this update)
3. Deployment history, logs, rollback, usage limits (history/logs done; rollback pending)
4. GitHub integration, templates, editor
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
