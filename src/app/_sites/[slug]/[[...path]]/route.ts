// IMPLEMENTED
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProjectBySlug, projectFilesCol, deploymentsCol } from "@/lib/firestore";

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

  const readySnap = await deploymentsCol(project.id)
    .where("isProduction", "==", true)
    .where("status", "==", "READY")
    .limit(1)
    .get();
  if (readySnap.empty) {
    return new NextResponse("This website hasn't been deployed yet.", { status: 404 });
  }

  const fileSnap = await projectFilesCol(project.id).where("path", "==", filePath).limit(1).get();
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

  return new NextResponse(file.content, {
    status: 200,
    headers: { "Content-Type": contentTypeFor(filePath) },
  });
}
