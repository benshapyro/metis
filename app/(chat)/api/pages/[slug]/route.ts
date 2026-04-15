import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { readPage } from "@/lib/metis/tools/read-page";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { slug: raw } = await params;
    let slug: string;
    try {
      slug = decodeURIComponent(raw);
    } catch {
      return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    }

    if (slug.includes("..") || slug.startsWith("/") || slug.includes("\\")) {
      return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    }

    const r = await readPage({ slug });
    if (!r.ok) {
      return NextResponse.json(
        { error: r.reason },
        { status: r.reason === "not_found" ? 404 : 500 }
      );
    }

    const titleRaw = r.data.frontmatter?.title;
    const title = typeof titleRaw === "string" ? titleRaw : slug;

    return NextResponse.json({
      slug: r.data.slug,
      title,
      content: r.data.content,
      frontmatter: r.data.frontmatter,
    });
  } catch (err) {
    console.error("[api/pages/[slug]] unhandled error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
