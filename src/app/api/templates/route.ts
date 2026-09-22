import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { templatesCol } from "@/lib/firestore";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await templatesCol().orderBy("name", "asc").get();
  const templates = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      description: data.description,
      category: data.category,
      framework: data.framework,
      authorName: data.authorName,
      tags: data.tags,
      previewUrl: data.previewUrl ?? null,
    };
  });
  return NextResponse.json({ templates });
}
