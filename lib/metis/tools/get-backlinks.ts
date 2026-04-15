import { tool } from "ai";
import { z } from "zod";
import { parseReferencedBy, safeReadMarkdown } from "@/lib/metis/wiki";
import type { ToolResult } from "./index";

export async function getBacklinks(input: {
  slug: string;
}): Promise<ToolResult<string[]>> {
  const res = await safeReadMarkdown(input.slug);
  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason,
      ...(res.detail ? { detail: res.detail } : {}),
    };
  }
  const backlinks = parseReferencedBy(res.content);
  return { ok: true, data: backlinks };
}

export const getBacklinksTool = tool({
  description:
    "Pages linking to this one (parsed from the Referenced By section). Essential for cross-domain synthesis: start at a page, walk outward.",
  inputSchema: z.object({ slug: z.string() }),
  execute: getBacklinks,
});
