import { tool } from "ai";
import { z } from "zod";
import { parseFrontmatter, safeReadMarkdown } from "@/lib/metis/wiki";
import type { ToolResult } from "./index";

const MAX_BYTES = 40 * 1024;

export interface ReadPageData {
  slug: string;
  frontmatter: Record<string, unknown> | null;
  content: string;
}

export async function readPage(input: {
  slug: string;
}): Promise<ToolResult<ReadPageData>> {
  const res = await safeReadMarkdown(input.slug);
  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason,
      ...(res.detail ? { detail: res.detail } : {}),
    };
  }
  const { frontmatter, body } = parseFrontmatter(res.content);
  const capped = body.length > MAX_BYTES;
  const content = capped ? body.slice(0, MAX_BYTES) : body;
  return {
    ok: true,
    data: { slug: input.slug, frontmatter, content },
    ...(capped ? { sizeCapped: true } : {}),
  };
}

export const readPageTool = tool({
  description:
    "Read a full wiki page by slug. Returns frontmatter and content.",
  inputSchema: z.object({
    slug: z
      .string()
      .describe(
        'Wiki slug, e.g. "shaping-overview" or "clients/acme/engagement-notes"'
      ),
  }),
  execute: readPage,
});
