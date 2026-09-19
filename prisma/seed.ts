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
          description: "A clean single-page portfolio.",
          category: "Portfolio",
          framework: "STATIC",
          authorName: "LaunchNest",
          tags: ["portfolio", "minimal"],
          filesJson: { "index.html": "<h1>Portfolio</h1>" },
        },
        {
          name: "SaaS Landing",
          description: "Hero, features, and pricing sections.",
          category: "SaaS",
          framework: "STATIC",
          authorName: "LaunchNest",
          tags: ["saas", "landing"],
          filesJson: { "index.html": "<h1>SaaS Landing</h1>" },
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
