import { tool } from 'ai';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { parseFrontmatter, wikiRoot } from '@/lib/metis/wiki';
import type { ToolResult } from './index';

export interface SearchHit {
  slug: string;
  score: number;
  snippet: string;
}

const MAX_LIMIT = 20;
const TIMEOUT_MS = 3000;

function rgJson(query: string, cwd: string): Promise<Array<{ path: string; text: string }>> {
  return new Promise((resolve) => {
    const rg = spawn(
      'rg',
      ['--json', '-i', '--max-count', '5', '--glob', '*.md', '-e', query],
      { cwd, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const hits: Array<{ path: string; text: string }> = [];
    let buf = '';
    const timer = setTimeout(() => rg.kill('SIGKILL'), TIMEOUT_MS);
    rg.stdout.on('data', (d) => {
      buf += d.toString();
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'match') {
            hits.push({
              path: ev.data.path.text,
              text: ev.data.lines.text.trim().slice(0, 240),
            });
          }
        } catch {
          /* ignore non-JSON */
        }
      }
    });
    rg.on('close', () => {
      clearTimeout(timer);
      resolve(hits);
    });
    rg.on('error', () => {
      clearTimeout(timer);
      resolve([]);
    });
  });
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0,
    idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) >= 0) {
    n++;
    idx += needle.length;
  }
  return n;
}

export async function searchPages(
  input: { query: string; limit?: number }
): Promise<ToolResult<SearchHit[]>> {
  const limit = Math.min(input.limit ?? 10, MAX_LIMIT);
  const root = wikiRoot();
  const hits = await rgJson(input.query, root);
  if (hits.length === 0) return { ok: true, data: [] };

  type Agg = { score: number; snippet: string; slug: string; foundByRg: boolean };
  const byFile = new Map<string, Agg>();
  for (const h of hits) {
    const full = path.isAbsolute(h.path) ? h.path : path.join(root, h.path);
    const slug = path.basename(full, '.md');
    const agg = byFile.get(full) ?? { score: 0, snippet: h.text, slug, foundByRg: true };
    agg.snippet ||= h.text;
    byFile.set(full, agg);
  }

  for (const [file, agg] of byFile.entries()) {
    const qLower = input.query.toLowerCase();
    try {
      const content = await fs.readFile(file, 'utf8');
      const { frontmatter, body } = parseFrontmatter(content);
      const titleRaw =
        typeof frontmatter?.title === 'string' ? frontmatter.title : agg.slug;
      const titleHits = countOccurrences(titleRaw.toLowerCase(), qLower);
      let tagHits = 0;
      if (Array.isArray(frontmatter?.tags)) {
        for (const tag of frontmatter.tags) {
          if (
            typeof tag === 'string' &&
            tag.toLowerCase().includes(qLower)
          ) {
            tagHits += 1;
          }
        }
      }
      const bodyHits = countOccurrences(body.toLowerCase(), qLower);
      agg.score = 3 * tagHits + 2 * titleHits + bodyHits;
    } catch {
      /* ignore */
    }
  }

  const sorted = Array.from(byFile.values())
    .filter((a) => a.score > 0 || a.foundByRg)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((a) => ({ slug: a.slug, score: a.score || 1, snippet: a.snippet }));

  return { ok: true, data: sorted };
}

export const searchPagesTool = tool({
  description:
    'Keyword + tag search across the wiki. Returns top matches ranked by score = 3*tag_hits + 2*title_hits + body_hits. Use before list_pages for general queries.',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  execute: searchPages,
});
