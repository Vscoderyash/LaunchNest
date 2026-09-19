// IMPLEMENTED
// Serves a deployed project's static files by slug, enforcing visibility.
// In production this would sit behind real wildcard-subdomain routing
// (project.launchnest.app -> here); locally/in this environment it's
// reached via middleware rewriting Host-based requests, or directly at
// /_sites/<slug>/<path>. See middleware.ts and README "Subdomain routing".

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  webmanifest: "application/manifest+json",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const { slug, path } = await params;
  const filePath = path && path.length > 0 ? path.join("/") : "index.html";

  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project || project.deletedAt) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Visibility enforcement (spec section 9): PUBLIC/UNLISTED are viewable by
  // anyone with the URL; UNLISTED just never appears in public listings
  // (enforced elsewhere, in query filters). PRIVATE requires the owner's session.
  if (project.visibility === "PRIVATE") {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== project.ownerId) {
      return new NextResponse("This website is private.", { status: 403 });
    }
  }

  const hasReadyDeployment = await prisma.deployment.findFirst({
    where: { projectId: project.id, isProduction: true, status: "READY" },
  });
  if (!hasReadyDeployment) {
    return new NextResponse("This website hasn't been deployed yet.", { status: 404 });
  }

  const file = await prisma.projectFile.findUnique({
    where: { projectId_path: { projectId: project.id, path: filePath } },
  });

  if (!file) {
    return new NextResponse("File not found.", { status: 404 });
  }
  if (file.content === null) {
    // Binary asset — bytes aren't persisted in this MVP's local storage (see README).
    return new NextResponse(
      "This asset type isn't served yet in the MVP (binary files need S3 storage).",
      { status: 501 }
    );
  }

  return new NextResponse(file.content, {
    status: 200,
    headers: { "Content-Type": contentTypeFor(filePath) },
  });
}
