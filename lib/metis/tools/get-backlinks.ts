import { tool } from 'ai';
import { z } from 'zod';
import { parseReferencedBy, safeReadMarkdown } from '@/lib/metis/wiki';
import type { ToolResult } from './index';

export async function getBacklinks(input: { slug: string }): Promise<ToolResult<string[]>> {
  const raw = await safeReadMarkdown(input.slug);
  if (raw === null) return { ok: false, reason: 'not_found' };
  const backlinks = parseReferencedBy(raw);
  return { ok: true, data: backlinks };
}

export const getBacklinksTool = tool({
  description:
    'Pages linking to this one (parsed from the Referenced By section). Essential for cross-domain synthesis: start at a page, walk outward.',
  inputSchema: z.object({ slug: z.string() }),
  execute: getBacklinks,
});
