// Run with: npm run seed
// Standalone script (not Next.js), so env vars need explicit loading —
// Next.js auto-loads .env for the app itself, but this script doesn't run
// through Next.js at all.
import "dotenv/config";
import { getAdminAuth, getDb } from "../src/lib/firebase-admin";
import {
  createProjectWithUniqueSlug,
  projectFilesCol,
  deploymentsCol,
  deploymentLogsCol,
  domainsCol,
  templatesCol,
  type TemplateDoc,
} from "../src/lib/firestore";

const DEMO_EMAIL = "demo@launchnest.app";
const DEMO_PASSWORD = "password123";

async function main() {
  const auth = getAdminAuth();
  const db = getDb();

  // 1. Demo Firebase Auth user (idempotent: reuse if it already exists).
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    uid = existing.uid;
    console.log(`Demo auth user already exists (${uid}).`);
  } catch {
    const created = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: "Demo User",
    });
    uid = created.uid;
    console.log(`Created demo auth user (${uid}).`);
  }

  // 2. Firestore user doc.
  await db.collection("users").doc(uid).set(
    { email: DEMO_EMAIL, name: "Demo User", planTier: "FREE", createdAt: new Date().toISOString() },
    { merge: true }
  );

  // 3. Demo project + file + deployment + domain (skip if one already exists
  // for this slug, so re-running the seed script is safe).
  const existingSlug = await db.collection("projectSlugs").doc("demo-portfolio").get();
  if (!existingSlug.exists) {
    const now = new Date().toISOString();
    const { id: projectId } = await createProjectWithUniqueSlug("demo-portfolio", {
      name: "Demo Portfolio",
      visibility: "PUBLIC",
      framework: "STATIC",
      ownerId: uid,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const html = "<!doctype html><html><body><h1>Demo Portfolio</h1></body></html>";
    await projectFilesCol(projectId).add({
      path: "index.html",
      content: html,
      size: Buffer.byteLength(html, "utf-8"),
      updatedAt: now,
    });

    const deploymentRef = deploymentsCol(projectId).doc();
    await deploymentRef.set({
      version: 1,
      status: "READY",
      source: "EDITOR",
      isProduction: true,
      isTemporary: false,
      expiresAt: null,
      buildStartedAt: now,
      buildFinishedAt: now,
      buildDurationMs: 850,
      createdAt: now,
    });
    await deploymentLogsCol(projectId, deploymentRef.id).add({
      message: "Deployment ready",
      level: "info",
      createdAt: now,
    });

    await domainsCol(projectId).add({
      hostname: "demo-portfolio.launchnest.app",
      isPrimary: true,
      isCustom: false,
      verified: false,
      createdAt: now,
    });

    console.log(`Created demo project (${projectId}).`);
  } else {
    console.log("Demo project already exists, skipping.");
  }

  // 4. Templates — fixed doc IDs so re-running this script updates content
  // in place instead of creating duplicates.
  const templates: Record<string, TemplateDoc> = {
    "minimal-portfolio": {
      name: "Minimal Portfolio",
      description: "A clean single-page portfolio with a hero and project grid.",
      category: "Portfolio",
      framework: "STATIC",
      authorName: "LaunchNest",
      tags: ["portfolio", "minimal"],
      filesJson: {
        "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Your Name</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<header class="hero">
  <h1>Your Name</h1>
  <p>Designer &amp; developer building things on the web.</p>
</header>
<main class="grid">
  <div class="card"><h2>Project One</h2><p>A short description of what it does.</p></div>
  <div class="card"><h2>Project Two</h2><p>A short description of what it does.</p></div>
  <div class="card"><h2>Project Three</h2><p>A short description of what it does.</p></div>
</main>
</body>
</html>`,
        "style.css": `:root { color-scheme: dark; }
body { margin: 0; font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; }
.hero { padding: 5rem 2rem; text-align: center; }
.hero h1 { font-size: 2.5rem; margin: 0 0 0.5rem; }
.hero p { color: #a3a3a3; }
.grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); max-width: 900px; margin: 0 auto; padding: 0 2rem 4rem; }
.card { border: 1px solid #262626; border-radius: 12px; padding: 1.5rem; }
.card h2 { margin-top: 0; font-size: 1.1rem; }`,
      },
    },
    "saas-landing": {
      name: "SaaS Landing",
      description: "Hero, feature grid, and a call-to-action section.",
      category: "SaaS",
      framework: "STATIC",
      authorName: "LaunchNest",
      tags: ["saas", "landing"],
      filesJson: {
        "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Your Product</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<header class="hero">
  <h1>Your Product Name</h1>
  <p>A one-line pitch that explains what it does and who it's for.</p>
  <a class="cta" href="#">Get started</a>
</header>
<section class="features">
  <div class="feature"><h3>Feature One</h3><p>What it does for the user.</p></div>
  <div class="feature"><h3>Feature Two</h3><p>What it does for the user.</p></div>
  <div class="feature"><h3>Feature Three</h3><p>What it does for the user.</p></div>
</section>
</body>
</html>`,
        "style.css": `:root { color-scheme: dark; }
body { margin: 0; font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; }
.hero { padding: 6rem 2rem; text-align: center; }
.hero h1 { font-size: 2.75rem; margin: 0 0 1rem; }
.hero p { color: #a3a3a3; max-width: 480px; margin: 0 auto 2rem; }
.cta { display: inline-block; background: #fafafa; color: #0a0a0a; padding: 0.75rem 1.5rem; border-radius: 999px; text-decoration: none; font-weight: 600; }
.features { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); max-width: 900px; margin: 0 auto; padding: 0 2rem 4rem; }
.feature { border: 1px solid #262626; border-radius: 12px; padding: 1.5rem; }
.feature h3 { margin-top: 0; }`,
      },
    },
  };

  for (const [id, data] of Object.entries(templates)) {
    await templatesCol().doc(id).set(data, { merge: true });
  }
  console.log(`Seeded ${Object.keys(templates).length} templates.`);

  console.log("\nSeed complete:");
  console.log(`  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
