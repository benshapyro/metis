import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export function wikiRoot(): string {
  const root = process.env.WIKI_ROOT;
  if (!root) throw new Error('WIKI_ROOT env var not set');
  return root;
}

const SEARCH_DIRS = [
  'practice', 'research', 'personal',
  'people', 'organizations', 'concepts', 'frameworks', 'tools',
  'published', '_meta', 'clients',
];

/**
 * Resolve a slug like 'shaping-overview' or 'acme/engagement-notes' to an
 * absolute path. Returns null if not found.
 */
export function resolveSlug(slug: string): string | null {
  const root = wikiRoot();
  const parts = slug.split('/');

  // Try direct path for nested slugs
  if (parts.length > 1) {
    const direct = path.join(root, `${slug}.md`);
    if (fsSync.existsSync(direct)) return direct;
  }

  // Try common directories
  const basename = parts[parts.length - 1];
  const maybeSubdir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  for (const dir of SEARCH_DIRS) {
    const candidate = path.join(root, dir, maybeSubdir, `${basename}.md`);
    if (fsSync.existsSync(candidate)) return candidate;
  }

  // Fall back to recursive search
  return walkFor(root, `${basename}.md`);
}

function walkFor(dir: string, filename: string): string | null {
  let entries: fsSync.Dirent[];
  try {
    entries = fsSync.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const hit = walkFor(full, filename);
      if (hit) return hit;
    } else if (e.name === filename) {
      return full;
    }
  }
  return null;
}

export function pageExists(slug: string): boolean {
  return resolveSlug(slug) !== null;
}

export async function safeReadMarkdown(slug: string): Promise<string | null> {
  const p = resolveSlug(slug);
  if (!p) return null;
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

export interface FrontmatterResult {
  frontmatter: Record<string, unknown> | null;
  body: string;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };

  const [, yamlBlock, rest] = match;
  try {
    const fm = parseYaml(yamlBlock);
    return { frontmatter: fm ?? {}, body: rest.trimStart() };
  } catch {
    return { frontmatter: null, body: rest.trimStart() };
  }
}

/**
 * Extracts wikilinks from the `## Referenced By` section (if present).
 * Returns a deduplicated list of slugs.
 */
export function parseReferencedBy(content: string): string[] {
  const idx = content.search(/^## Referenced By\b/m);
  if (idx < 0) return [];

  const after = content.slice(idx);
  const endMatch = after.slice(2).search(/^##?[^#]/m);
  const scoped = endMatch < 0 ? after : after.slice(0, 2 + endMatch);

  const slugs = new Set<string>();
  for (const m of scoped.matchAll(/\[\[([^\]\n|]+?)(?:\|[^\]\n]*)?\]\]/g)) {
    slugs.add(m[1].trim());
  }
  return Array.from(slugs);
}
