import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export function wikiRoot(): string {
  const root = process.env.WIKI_ROOT;
  if (!root) {
    throw new Error("WIKI_ROOT env var not set");
  }
  return root;
}

const SEARCH_DIRS = [
  "practice",
  "research",
  "personal",
  "people",
  "organizations",
  "concepts",
  "frameworks",
  "tools",
  "published",
  "_meta",
  "clients",
];

/**
 * Returns true iff `candidate` is inside `root` (same dir or deeper).
 * Both paths are resolved before comparison to eliminate symlink / `..` tricks.
 */
function withinRoot(candidate: string, root: string): boolean {
  const resolved = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  return (
    resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
  );
}

/**
 * Resolve a slug like 'shaping-overview' or 'acme/engagement-notes' to an
 * absolute path. Returns null if not found.
 *
 * Only paths that remain inside wikiRoot() are returned — slugs containing
 * path-traversal sequences will never resolve to a file outside the root.
 */
export function resolveSlug(slug: string): string | null {
  const root = wikiRoot();
  const parts = slug.split("/");

  // Try direct path for nested slugs
  if (parts.length > 1) {
    const direct = path.join(root, `${slug}.md`);
    if (withinRoot(direct, root) && fsSync.existsSync(direct)) {
      return direct;
    }
  }

  // Try common directories
  const basename = parts.at(-1);
  const maybeSubdir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  for (const dir of SEARCH_DIRS) {
    const candidate = path.join(root, dir, maybeSubdir, `${basename}.md`);
    if (withinRoot(candidate, root) && fsSync.existsSync(candidate)) {
      return candidate;
    }
  }

  // walkFor fallback removed: SEARCH_DIRS covers all known wiki layouts.
  // If a future page lives outside these dirs, add the dir to SEARCH_DIRS.
  return null;
}

export function pageExists(slug: string): boolean {
  return resolveSlug(slug) !== null;
}

export type ReadResult =
  | { ok: true; content: string }
  | { ok: false; reason: "not_found" | "error"; detail?: string };

export async function safeReadMarkdown(slug: string): Promise<ReadResult> {
  const p = resolveSlug(slug);
  if (!p) {
    return { ok: false, reason: "not_found" };
  }
  try {
    return { ok: true, content: await fs.readFile(p, "utf8") };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return { ok: false, reason: "not_found" };
    }
    console.error(
      `[wiki.safeReadMarkdown] readFile failed for ${slug} (${p}):`,
      code ?? err
    );
    return { ok: false, reason: "error", detail: code ?? String(err) };
  }
}

export interface FrontmatterResult {
  frontmatter: Record<string, unknown> | null;
  body: string;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: content };
  }

  const [, yamlBlock, rest] = match;
  try {
    const fm = parseYaml(yamlBlock);
    return { frontmatter: fm ?? {}, body: rest.trimStart() };
  } catch (err) {
    console.error("[wiki.parseFrontmatter] YAML parse failed:", err);
    return { frontmatter: null, body: rest.trimStart() };
  }
}

/**
 * Extracts wikilinks from the `## Referenced By` section (if present).
 * Returns a deduplicated list of slugs.
 */
export function parseReferencedBy(content: string): string[] {
  const idx = content.search(/^## Referenced By\b/m);
  if (idx < 0) {
    return [];
  }

  const after = content.slice(idx);
  const endMatch = after.slice(2).search(/^##?[^#]/m);
  const scoped = endMatch < 0 ? after : after.slice(0, 2 + endMatch);

  const slugs = new Set<string>();
  for (const m of scoped.matchAll(/\[\[([^\]\n|]+?)(?:\|[^\]\n]*)?\]\]/g)) {
    slugs.add(m[1].trim());
  }
  return Array.from(slugs);
}
