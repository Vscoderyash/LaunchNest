# LaunchNest

Build it. Deploy it. Own the web. — a website-builder/hosting platform:
idea → create/import → build → deploy → live subdomain.

**Backend: Firebase.** Auth is Firebase Authentication (email/password +
Google), data is Firestore. This replaced an earlier Postgres/Prisma/Auth.js
version — see "Why Firebase, and what changed" below if you're wondering
why the code doesn't look like a typical Prisma app.

This is a real, runnable Next.js app with real auth and a real database —
not a landing-page-only mock. See "Status" for exactly what's implemented,
mocked, or still future work, and "Firestore data model" for how the schema
differs from a relational design.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Firebase Authentication (email/password + Google) + Firestore
- Vitest for unit tests

## Setup

```bash
npm install
cp .env.example .env   # fill in Firebase client config + admin key + ENCRYPTION_KEY
npm run seed            # creates demo@launchnest.app / password123 + 2 templates
npm run dev
```

Getting the env vars:
- **`NEXT_PUBLIC_FIREBASE_*`**: Firebase Console → Project Settings → General
  → Your apps → Web app. These are *not* secret — Firebase's client config
  is meant to be public (real security comes from Auth + Firestore rules).
- **`FIREBASE_SERVICE_ACCOUNT_KEY`**: Firebase Console → Project Settings →
  Service Accounts → Generate new private key → paste the whole downloaded
  JSON file as one line. This one **is** a real secret — full admin access
  to your Firebase project. Never commit it, never send it to the client.
- **`ENCRYPTION_KEY`**: `openssl rand -base64 32` — encrypts env var values
  and GitHub PATs at rest.

Before any of this works, enable **Email/Password** and **Google** as
sign-in providers in Firebase Console → Authentication → Sign-in method.

Run tests: `npm test`. Lint: `npm run lint`. Build: `npm run build`.

## Status: IMPLEMENTED / MOCKED / FUTURE

**IMPLEMENTED** (real, working, tested):
- Firebase Auth: email/password + Google sign-in, session cookies minted via
  Admin SDK (`src/app/api/auth/session`), verified server-side on every
  protected page/route (`src/lib/session.ts`)
- Full Firestore data model — every concept from the product spec (projects,
  deployments + logs, files, domains, env vars, GitHub connections/imports,
  templates) — see "Firestore data model" below for the exact shape
- Project CRUD with strict ownership checks (a user can never read/edit
  another user's project — enforced server-side on every route)
- Slug generation + atomic uniqueness via Firestore transactions
  (`createProjectWithUniqueSlug` in `src/lib/firestore.ts`), reserved-name
  blocking
- Free-plan limits (3 projects, storage cap) enforced at creation/upload
- Deployment history + state machine, versioning, production/temporary
  flags, auto subdomain assignment, rollback
- ZIP upload and GitHub import (via personal access token — see note below),
  both running through the same validation pipeline (`src/lib/zip.ts`):
  index.html requirement, path-traversal protection, zip-bomb guard, and a
  **Firestore document size cap** (see "Firestore data model")
- Subdomain routing architecture (`middleware.ts` + `/_sites/[slug]/...`),
  visibility enforcement (PRIVATE/PUBLIC/UNLISTED) at the serving layer
- Environment variables encrypted at rest (AES-256-GCM), API only ever
  returns keys, never values, after creation
- Template marketplace with a real "use this template" flow
- Editor: file tree, textarea, and a live client-side preview
- Real Settings tab (rename, change visibility, delete)
- 25 unit tests — all pure logic (slug validation, path safety, plan
  limits, ZIP extraction including the Firestore size cap, encryption
  round-trip) and so unaffected by the Postgres→Firebase migration

**MOCKED**:
- The deployment "build" step — instant synthetic success for static files,
  no real build container (see `src/app/api/projects/[id]/deployments/route.ts`)
- File storage — text files live directly in Firestore documents; binary
  assets (images, fonts) are recorded as metadata only, their bytes aren't
  persisted (see the Firestore size-cap note below). FUTURE: Firebase
  Storage is the natural fit given the rest of the stack.
- Real wildcard subdomains — the routing architecture works
  (`/_sites/<slug>` works right now), but `*.yourdomain` needs a custom
  domain with wildcard DNS configured on the host, which is an infra step
  outside this repo

**FUTURE**: AI website generation, analytics ingestion, custom domains +
DNS/SSL, teams, billing, a public "explore" page for PUBLIC projects, a real
OAuth "Connect GitHub" flow (see note below), Monaco-based editing,
multi-file live preview, cancelling in-flight deployments (moot until real
async builds exist).

## Firestore data model

Firestore is a document store, not relational — a few things had to be
designed differently than the old Prisma/Postgres schema:

```
users/{uid}                          -> { email, name, planTier, createdAt }
projectSlugs/{slug}                  -> { projectId }   (see "Slug uniqueness" below)
projects/{projectId}                 -> { name, slug, visibility, framework, ownerId, ... }
  files/{autoId}                     -> { path, content, size, updatedAt }
  deployments/{autoId}               -> { version, status, isProduction, ... }
    logs/{autoId}                    -> { message, level, createdAt }
  envVars/{autoId}                   -> { key, encryptedValue, createdAt, updatedAt }
  domains/{autoId}                   -> { hostname, isPrimary, isCustom, ... }
githubConnections/{uid}              -> { githubUsername, encryptedAccessToken, ... }
templates/{templateId}               -> { name, description, filesJson, ... }
```

**Slug uniqueness.** Postgres gave us `slug String @unique` for free.
Firestore has no unique constraints, so `projectSlugs/{slug}` acts as a
uniqueness ledger: creating a project is a transaction that checks
`projectSlugs/{slug}` doesn't exist, then writes both the slug doc and the
project doc atomically. `getProjectBySlug()` reads through this ledger
rather than querying `projects` by a `slug` field directly.

**No cross-project SQL aggregates.** Prisma's `aggregate({ _sum: ... })`
doesn't have a Firestore equivalent across collections. Storage-limit checks
(`src/app/api/projects/[id]/upload/route.ts`) walk each of a user's other
projects' files and sum client-side — fine at this scale, would need a
maintained counter field on the user doc at real scale. The deployments
list page (`/dashboard/deployments`) does the same per-project fan-out
rather than a `collectionGroup` query, specifically to avoid needing a
composite index created in the Firebase console before the page works.

**Firestore's 1 MiB document size limit.** This is the one real constraint
switching off Postgres introduced. A Postgres `TEXT` column had effectively
no size limit for a project file's content; a single Firestore document
does (1,048,576 bytes, including all fields). `src/lib/zip.ts` enforces a
`MAX_FIRESTORE_TEXT_BYTES` (900 KB, leaving headroom) — any text file over
that from a ZIP upload or GitHub import is demoted to metadata-only (same
handling as a genuine binary file) with a warning, rather than crashing the
whole request when Firestore rejects an oversized write. The editor's save
endpoint enforces the same cap before attempting a write. This mostly
matters for larger built JS bundles; hand-written HTML/CSS/JS for the static
sites this MVP targets rarely gets close.

## GitHub import: PAT instead of OAuth-connect

The spec calls for a "Connect GitHub" OAuth flow. Import is implemented via
a **personal access token** instead — the token is encrypted at rest (same
AES-256-GCM as env vars) and never sent back to the client, so it has the
same security properties the spec asks for, just a simpler flow than a full
OAuth handshake. This predates the Firebase migration and the reasoning is
unchanged: a second GitHub OAuth account (this one needing `repo` scope,
separate from whatever provider handles login) linked to an existing signed-in
user is a real can of worms with most auth libraries' account-linking rules.
Swapping in true OAuth-connect later is a contained change — same
`githubConnections` collection, same `src/lib/github.ts` helpers, just a
different route populating `encryptedAccessToken`.

## Editor: what "live preview" actually means here

The editor's preview pane doesn't ask the server anything — it builds the
preview entirely in the browser by inlining `style.css` into `<head>` and
`script.js` before `</body>` of whatever `index.html` currently says (the
in-progress draft, not just the last save). That's genuinely live and fast,
but a file referencing *other* files via `<link>`/`<script src="...">`
beyond the conventional three won't resolve inside the sandboxed `srcDoc` —
proper multi-file preview needs blob URLs or a service worker (FUTURE).

## Why Firebase, and what changed

The product spec originally called for PostgreSQL + Prisma + Auth.js; this
was later changed mid-build to Firebase Authentication + Firestore, using
an existing Firebase project. The swap touched nearly every server-side
file: `src/lib/auth.ts` (Auth.js) → `src/lib/session.ts` +
`src/lib/firebase-admin.ts`; `src/lib/prisma.ts` + `prisma/schema.prisma` →
`src/lib/firestore.ts`; every API route's Prisma calls → Firestore Admin
SDK calls; `middleware.ts`'s auth check downgraded from a full JWT
verification to a cookie-presence check, because Firebase Admin SDK needs
Node.js APIs that Next.js's Edge middleware runtime doesn't have — real
verification now happens in every Server Component/Route Handler via
`getSession()` instead (Node runtime), which is the actual security
boundary; the middleware redirect is a UX nicety on top of it, not the
enforcement.

The 25 unit tests didn't need to change at all — they test pure logic
(`src/lib/slug.ts`, `src/lib/limits.ts`, `src/lib/zip.ts`,
`src/lib/encryption.ts`) with no dependency on which database sits behind
the app.

## Known dependency vulnerability (not fixable from here)

`npm audit` reports a moderate `uuid` vulnerability three levels deep in
`firebase-admin`'s own dependency tree (via `gaxios`, a Google API client
library `firebase-admin` depends on). It's not reachable through anything
this app's code does with `uuid` — fixing it would mean forcing a version
bump inside `firebase-admin`'s dependency tree, which risks breaking the
Admin SDK. Worth revisiting when `firebase-admin` itself updates its
`gaxios` dependency upstream.

## Project structure

```
src/
  app/            routes (App Router) — (dashboard)/dashboard/* holds every
                  authenticated page; _sites/[slug]/... serves live sites
  components/     UI components (dashboard/, icons/, ui/)
  lib/            firebase-client.ts, firebase-admin.ts, session.ts,
                  firestore.ts, limits.ts, slug.ts, zip.ts, encryption.ts,
                  github.ts + tests
scripts/
  seed.ts         demo Firebase Auth user + Firestore project/deployment/templates
```

Note the `(dashboard)/dashboard/` nesting: the route group `(dashboard)`
holds the shared auth-gated layout, and a literal `dashboard/` folder
inside it is what actually puts every page at `/dashboard/websites`,
`/dashboard/settings`, etc. — matching what the sidebar, buttons, and
redirects throughout the app already link to. (This tripped up an earlier
version of this codebase, where sibling pages sat directly under
`(dashboard)/` and silently resolved to `/websites`, `/settings` and so on
instead — a genuine bug that only surfaced once a full `next build` ran to
completion and printed the real route manifest.)

## Build order (unchanged from the product spec)

1. **Auth, database, dashboard, project creation** — done
2. **ZIP upload, static deployment, subdomains, public/private** — done
3. **Deployment history, logs, rollback, environment variables** — done
4. **GitHub integration, templates, editor** — done (GitHub via PAT rather
   than OAuth-connect, editor is textarea-based — see notes above)
5. AI website generation
6. Analytics, custom domains, temporary deployments (temporary deployments partially done)
7. Teams, billing, advanced infrastructure
