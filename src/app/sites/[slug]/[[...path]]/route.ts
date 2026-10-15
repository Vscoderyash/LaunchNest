// IMPLEMENTED
// Serves a project's live site from its ACTIVE DEPLOYMENT'S SNAPSHOT (not the
// editor's working files), enforcing visibility, honouring temporary-deployment
// expiry, and recording privacy-friendly page views (no cookies, no stored IPs).
import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/session";
import {
  getProjectBySlug,
  projectFilesCol,
  deploymentsCol,
  deploymentFilesCol,
  analyticsEventsCol,
  withId,
  type DeploymentDoc,
} from "@/lib/firestore";
import { pickActiveDeployment } from "@/lib/deployments";
import { isBot, parseUserAgent, referrerHost, visitorHash, pagePathFor } from "@/lib/analytics";

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
  req: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const { slug, path } = await params;
  const filePath = path && path.length > 0 ? path.join("/") : "index.html";

  const project = await getProjectBySlug(slug);
  if (!project || project.deletedAt) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (project.visibility === "PRIVATE") {
    const session = await getSession();
    if (!session || session.uid !== project.ownerId) {
      return new NextResponse("This website is private.", { status: 403 });
    }
  }

  const deploymentsSnap = await deploymentsCol(project.id).orderBy("version", "desc").limit(20).get();
  const active = pickActiveDeployment(deploymentsSnap.docs.map((d) => withId<DeploymentDoc>(d)));
  if (!active.deployment) {
    return new NextResponse(
      active.reason === "expired"
        ? "This temporary deployment has expired."
        : "This website hasn't been deployed yet.",
      { status: active.reason === "expired" ? 410 : 404 }
    );
  }

  // Deployments made before snapshots existed have no file copy — serve the
  // working files for those so older deployments keep working.
  const filesCol = active.deployment.snapshot
    ? deploymentFilesCol(project.id, active.deployment.id)
    : projectFilesCol(project.id);
  const fileSnap = await filesCol.where("path", "==", filePath).limit(1).get();
  if (fileSnap.empty) {
    return new NextResponse("File not found.", { status: 404 });
  }
  const file = fileSnap.docs[0].data();
  if (file.content === null) {
    return new NextResponse(
      "This asset type isn't served yet in the MVP (binary files need object storage).",
      { status: 501 }
    );
  }

  const contentType = contentTypeFor(filePath);

  // Page views only: public/unlisted sites, HTML documents, real browsers.
  if (project.visibility !== "PRIVATE" && contentType.startsWith("text/html")) {
    const ua = req.headers.get("user-agent") ?? "";
    if (!isBot(ua)) {
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const { device, browser } = parseUserAgent(ua);
      const now = new Date();
      const event = {
        path: pagePathFor(filePath),
        referrer: referrerHost(req.headers.get("referer"), req.headers.get("host")),
        country: req.headers.get("x-vercel-ip-country"),
        device,
        browser,
        visitor: visitorHash({
          ip,
          ua,
          projectId: project.id,
          date: now.toISOString().slice(0, 10),
          secret: process.env.ENCRYPTION_KEY ?? "launchnest",
        }),
        createdAt: now.toISOString(),
      };
      // Runs after the response is sent so it never slows the page down.
      after(async () => {
        try {
          await analyticsEventsCol(project.id).add(event);
        } catch (err) {
          console.error("analytics write failed", err);
        }
      });
    }
  }

  return new NextResponse(file.content, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}
