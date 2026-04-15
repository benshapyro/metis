import { tool } from 'ai';
import { z } from 'zod';
import { parseFrontmatter, safeReadMarkdown } from '@/lib/metis/wiki';
import type { ToolResult } from './index';

const MAX_PARAGRAPH_BYTES = 2 * 1024;

export interface ReadFrontmatterData {
  slug: string;
  frontmatter: Record<string, unknown> | null;
  first_paragraph: string;
}

export async function readFrontmatter(input: { slug: string }): Promise<ToolResult<ReadFrontmatterData>> {
  const raw = await safeReadMarkdown(input.slug);
  if (raw === null) return { ok: false, reason: 'not_found' };
  const { frontmatter, body } = parseFrontmatter(raw);
  const afterTitle = body.replace(/^#\s[^\n]*\n+/, '');
  const firstPara = afterTitle.split(/\n\s*\n/, 1)[0] ?? '';
  const capped = firstPara.slice(0, MAX_PARAGRAPH_BYTES);
  return { ok: true, data: { slug: input.slug, frontmatter, first_paragraph: capped } };
}

export const readFrontmatterTool = tool({
  description:
    'Cheap peek at a page: frontmatter and first paragraph only. Use for triage before full read.',
  inputSchema: z.object({ slug: z.string() }),
  execute: readFrontmatter,
});
