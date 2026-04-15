import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { parseFrontmatter, wikiRoot } from "@/lib/metis/wiki";
import type { ToolResult } from "./index";

export interface SearchHit {
  slug: string;
  score: number;
  snippet: string;
}

const MAX_LIMIT = 20;
const TIMEOUT_MS = 3000;
const SNIPPET_BYTES = 240;
const SKIP_DIRS = new Set([".git", "node_modules", "_archive"]);

async function* walkAllMarkdown(
  dir: string,
  rel = ""
): AsyncGenerator<{ abs: string; rel: string }> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return; // benign
    }
    console.error(`[search_pages] readdir failed for ${dir}:`, code ?? err);
    throw err; // surface real errors
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) {
      continue;
    }
    const full = path.join(dir, e.name);
    const relPath = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      yield* walkAllMarkdown(full, relPath);
    } else if (e.name.endsWith(".md")) {
      yield { abs: full, rel: relPath };
    }
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }
  let n = 0;
  let idx = haystack.indexOf(needle, 0);
  while (idx >= 0) {
    n++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return n;
}

function firstMatchSnippet(body: string, needleLower: string): string {
  const idx = body.toLowerCase().indexOf(needleLower);
  if (idx < 0) {
    return "";
  }
  const start = Math.max(0, idx - 60);
  const end = Math.min(body.length, idx + 180);
  return body
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SNIPPET_BYTES);
}

export async function searchPages(input: {
  query: string;
  limit?: number;
}): Promise<ToolResult<SearchHit[]>> {
  const limit = Math.min(input.limit ?? 10, MAX_LIMIT);
  const query = input.query.trim();
  if (!query) {
    return { ok: true, data: [] };
  }
  const qLower = query.toLowerCase();
  const root = wikiRoot();

  const startMs = Date.now();
  const hits: SearchHit[] = [];
  let timedOut = false;

  try {
    for await (const { abs, rel } of walkAllMarkdown(root)) {
      if (Date.now() - startMs > TIMEOUT_MS) {
        timedOut = true;
        break;
      }
      let content: string;
      try {
        content = await fs.readFile(abs, "utf8");
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "ENOENT") {
          continue;
        }
        console.error(
          `[search_pages] readFile failed for ${rel}:`,
          code ?? err
        );
        continue; // skip unreadable file but keep searching
      }
      const { frontmatter, body } = parseFrontmatter(content);
      const titleRaw =
        typeof frontmatter?.title === "string"
          ? frontmatter.title
          : path.basename(rel, ".md");
      const tagsStr = Array.isArray(frontmatter?.tags)
        ? (frontmatter.tags as unknown[]).join(" ").toLowerCase()
        : "";
      const titleHits = countOccurrences(titleRaw.toLowerCase(), qLower);
      const tagHits = countOccurrences(tagsStr, qLower);
      const bodyHits = countOccurrences(body.toLowerCase(), qLower);
      const score = 3 * tagHits + 2 * titleHits + bodyHits;
      if (score === 0) {
        continue;
      }
      hits.push({
        slug: path.basename(rel, ".md"),
        score,
        snippet: firstMatchSnippet(body, qLower) || titleRaw,
      });
    }
  } catch (err: unknown) {
    console.error("[search_pages] walk failed:", err);
    return { ok: false, reason: "error", detail: String(err) };
  }

  if (timedOut) {
    return {
      ok: false,
      reason: "timeout",
      detail: `search exceeded ${TIMEOUT_MS}ms; ${hits.length} partial results discarded`,
    };
  }

  const sorted = hits.sort((a, b) => b.score - a.score).slice(0, limit);
  return {
    ok: true,
    data: sorted,
    ...(hits.length > limit ? { sizeCapped: true } : {}),
  };
}

export const searchPagesTool = tool({
  description:
    "Keyword + tag search across the wiki. Returns top matches ranked by score = 3*tag_hits + 2*title_hits + body_hits. Use before list_pages for general queries. Returns up to 20 results; if more matched, sizeCapped is set.",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  execute: searchPages,
});
