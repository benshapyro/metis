import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { wikiRoot } from '@/lib/metis/wiki';
import type { ToolResult } from './index';

const MAX_ENTRIES = 500;

async function* walkMarkdown(dir: string, rel = ''): AsyncGenerator<string> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    const relPath = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      yield* walkMarkdown(full, relPath);
    } else if (e.name.endsWith('.md')) {
      yield relPath.replace(/\.md$/, '');
    }
  }
}

export async function listPages(
  input: { path: string; filter?: string }
): Promise<ToolResult<string[]>> {
  const base = path.join(wikiRoot(), input.path);
  try {
    await fs.access(base);
  } catch {
    return { ok: false, reason: 'not_found' };
  }
  const out: string[] = [];
  let capped = false;
  for await (const rel of walkMarkdown(base)) {
    const slug = rel.split('/').pop() ?? rel;
    if (input.filter && !slug.toLowerCase().includes(input.filter.toLowerCase())) continue;
    if (out.length >= MAX_ENTRIES) {
      capped = true;
      break;
    }
    out.push(slug);
  }
  return { ok: true, data: out, ...(capped ? { sizeCapped: true } : {}) };
}

export const listPagesTool = tool({
  description:
    'List wiki pages within a path (required). Use for scoped enumeration like "clients/acme" or "people". Do not call without a path scope; prefer search_pages for general search.',
  inputSchema: z.object({
    path: z.string().describe('Path under wiki/, required'),
    filter: z.string().optional().describe('Optional case-insensitive substring to match on slugs'),
  }),
  execute: listPages,
});
