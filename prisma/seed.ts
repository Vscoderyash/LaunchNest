// Run with: npx prisma db seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@launchnest.app" },
    update: {},
    create: {
      email: "demo@launchnest.app",
      name: "Demo User",
      passwordHash,
    },
  });

  await prisma.usageRecord.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: { userId: demoUser.id },
  });

  const project = await prisma.project.upsert({
    where: { slug: "demo-portfolio" },
    update: {},
    create: {
      name: "Demo Portfolio",
      slug: "demo-portfolio",
      visibility: "PUBLIC",
      framework: "STATIC",
      ownerId: demoUser.id,
      files: {
        create: [
          {
            path: "index.html",
            content: "<!doctype html><html><body><h1>Demo Portfolio</h1></body></html>",
          },
        ],
      },
    },
  });

  const deployment = await prisma.deployment.upsert({
    where: { projectId_version: { projectId: project.id, version: 1 } },
    update: {},
    create: {
      projectId: project.id,
      version: 1,
      status: "READY",
      source: "EDITOR",
      isProduction: true,
      buildStartedAt: new Date(),
      buildFinishedAt: new Date(),
      buildDurationMs: 850,
    },
  });

  await prisma.deploymentLog.createMany({
    data: [
      { deploymentId: deployment.id, message: "Deployment queued" },
      { deploymentId: deployment.id, message: "Build finished" },
      { deploymentId: deployment.id, message: "Deployment ready" },
    ],
    skipDuplicates: true,
  });

  await prisma.domain.upsert({
    where: { hostname: "demo-portfolio.launchnest.app" },
    update: {},
    create: {
      projectId: project.id,
      hostname: "demo-portfolio.launchnest.app",
      isPrimary: true,
    },
  });

  const templateCount = await prisma.template.count();
  if (templateCount === 0) {
    await prisma.template.createMany({
      data: [
        {
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
        {
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
      ],
    });
  }

  console.log("Seed complete:");
  console.log("  demo@launchnest.app / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
