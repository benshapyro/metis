// lib/metis/citation-allowlist.ts — thread-wide citation allowlist builder.
// Aggregates read_page / read_frontmatter tool outputs across all assistant
// messages in a thread so cross-turn syntheses can cite pages retrieved in
// earlier turns without re-reading them. Per-turn audit still lives in
// retrievalTrace.{citedPages,hallucinatedCitations}.
//
// Trust boundary: this function trusts every assistant message in `messages`,
// including those replayed from /api/messages or auto-resume. A persisted
// `output-available` part with `ok: true` is treated as a verified read even
// if the underlying wiki page has since been deleted or modified. v1 accepts
// this — adding provenance metadata + per-aggregate freshness checks is v1.1
// scope. Until then, defend at the type-guard layer (below) to prevent
// malformed parts from poisoning the allowlist with undefined-keyed entries.

import { getToolName, isStaticToolUIPart } from "ai";
import type { CitationSource } from "@/components/metis/citation-context";
import type { MetisUIMessage } from "@/lib/metis/agent";

export interface CitationContext {
  allowlist: Set<string>;
  sourcesBySlug: Record<string, CitationSource>;
}

type ReadToolOutput = {
  ok: boolean;
  data?: { slug: string; frontmatter: Record<string, unknown> | null };
};

export function buildCitationContext(
  messages: readonly MetisUIMessage[]
): CitationContext {
  const allowlist = new Set<string>();
  const sourcesBySlug: Record<string, CitationSource> = {};
  for (const msg of messages) {
    for (const p of msg.parts) {
      if (!isStaticToolUIPart(p)) {
        continue;
      }
      const name = String(getToolName(p));
      if (
        (name !== "read_page" && name !== "read_frontmatter") ||
        p.state !== "output-available"
      ) {
        continue;
      }
      const out = p.output as ReadToolOutput;
      // Strict guards: only trust outputs with explicit ok===true AND a
      // non-empty string slug. A loose truthy check would let an
      // `out.ok = "yes"` or undefined-slug part poison the allowlist with
      // an empty-string key that matches anything.
      if (
        out?.ok !== true ||
        typeof out?.data?.slug !== "string" ||
        out.data.slug.length === 0
      ) {
        continue;
      }
      const slug = out.data.slug;
      // First read wins: if a page is re-read later in the thread we keep
      // the earliest title/confidence to give the user a stable label.
      if (sourcesBySlug[slug]) {
        continue;
      }
      allowlist.add(slug);
      sourcesBySlug[slug] = {
        slug,
        title: (out.data.frontmatter?.title as string | undefined) ?? slug,
        confidence: out.data.frontmatter?.confidence as string | undefined,
      };
    }
  }
  return { allowlist, sourcesBySlug };
}
