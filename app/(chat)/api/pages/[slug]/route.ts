import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { readPage } from '@/lib/metis/tools/read-page';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const r = await readPage({ slug });
  if (!r.ok) {
    return NextResponse.json(
      { error: r.reason },
      { status: r.reason === 'not_found' ? 404 : 500 },
    );
  }
  const title = (r.data.frontmatter?.title as string | undefined) ?? slug;
  return NextResponse.json({
    slug: r.data.slug,
    title,
    content: r.data.content,
    frontmatter: r.data.frontmatter,
  });
}
