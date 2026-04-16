import { describe, expect, it } from "vitest";
import type { MetisUIMessage } from "@/lib/metis/agent";
import { buildCitationContext } from "@/lib/metis/citation-allowlist";

// Tiny factory: construct an assistant MetisUIMessage with one successful
// read_page tool part for `slug`. The static tool part shape mirrors what the
// AI SDK emits and what isStaticToolUIPart recognizes.
function assistantWithRead(slug: string, title?: string): MetisUIMessage {
  return {
    id: `m-${slug}`,
    role: "assistant",
    parts: [
      {
        type: "tool-read_page",
        state: "output-available",
        toolCallId: `c-${slug}`,
        input: { slug },
        output: {
          ok: true,
          data: {
            slug,
            frontmatter: title ? { title } : null,
          },
        },
      },
    ],
  } as unknown as MetisUIMessage;
}

describe("buildCitationContext", () => {
  it("aggregates allowlist across prior + current messages", () => {
    const m1 = assistantWithRead("clients/hhmi/onboarding", "HHMI Onboarding");
    const m2 = assistantWithRead("concepts/pilot-purgatory", "Pilot Purgatory");
    const { allowlist, sourcesBySlug } = buildCitationContext([m1, m2]);
    expect(allowlist.has("clients/hhmi/onboarding")).toBe(true);
    expect(allowlist.has("concepts/pilot-purgatory")).toBe(true);
    expect(sourcesBySlug["clients/hhmi/onboarding"]?.title).toBe(
      "HHMI Onboarding"
    );
  });

  it("cross-turn: slug retrieved in turn 1 is in the allowlist on turn 3", () => {
    // Simulates the Q7 regression: HHMI page read in turn 1, NOT re-read in
    // turn 3. Without thread-wide aggregation this would render as unverified.
    const turn1 = assistantWithRead(
      "clients/hhmi/strategy-review",
      "HHMI Strategy Review"
    );
    const turn3 = assistantWithRead(
      "concepts/cross-client-patterns",
      "Cross-Client Patterns"
    );
    const { allowlist } = buildCitationContext([turn1, turn3]);
    expect(allowlist.has("clients/hhmi/strategy-review")).toBe(true);
  });

  it("ignores failed reads (ok: false)", () => {
    const failed = {
      id: "m-failed",
      role: "assistant",
      parts: [
        {
          type: "tool-read_page",
          state: "output-available",
          toolCallId: "c-failed",
          input: { slug: "nope" },
          output: { ok: false, reason: "not_found" },
        },
      ],
    } as unknown as MetisUIMessage;
    const { allowlist } = buildCitationContext([failed]);
    expect(allowlist.size).toBe(0);
  });

  it("falls back to slug as title when frontmatter has no title", () => {
    const m = assistantWithRead("concepts/x");
    const { sourcesBySlug } = buildCitationContext([m]);
    expect(sourcesBySlug["concepts/x"]?.title).toBe("concepts/x");
  });

  it("first read wins for a given slug (later reads don't overwrite)", () => {
    const first = assistantWithRead("shared/page", "First Title");
    const second = assistantWithRead("shared/page", "Second Title");
    const { sourcesBySlug } = buildCitationContext([first, second]);
    expect(sourcesBySlug["shared/page"]?.title).toBe("First Title");
  });

  it("rejects malformed parts: missing slug, non-string slug, empty slug", () => {
    const malformed = {
      id: "m-bad",
      role: "assistant",
      parts: [
        // missing data entirely
        {
          type: "tool-read_page",
          state: "output-available",
          toolCallId: "c1",
          input: {},
          output: { ok: true },
        },
        // data present but no slug
        {
          type: "tool-read_page",
          state: "output-available",
          toolCallId: "c2",
          input: {},
          output: { ok: true, data: { frontmatter: null } },
        },
        // slug is non-string
        {
          type: "tool-read_page",
          state: "output-available",
          toolCallId: "c3",
          input: {},
          output: { ok: true, data: { slug: 42, frontmatter: null } },
        },
        // empty-string slug
        {
          type: "tool-read_page",
          state: "output-available",
          toolCallId: "c4",
          input: {},
          output: { ok: true, data: { slug: "", frontmatter: null } },
        },
      ],
    } as unknown as MetisUIMessage;
    const { allowlist, sourcesBySlug } = buildCitationContext([malformed]);
    expect(allowlist.size).toBe(0);
    expect(sourcesBySlug).toEqual({});
  });

  it("rejects truthy-but-not-true ok values (defends against future contract drift)", () => {
    const fuzzy = {
      id: "m-fuzzy",
      role: "assistant",
      parts: [
        {
          type: "tool-read_page",
          state: "output-available",
          toolCallId: "c-fuzzy",
          input: { slug: "concepts/x" },
          // ok is a truthy string instead of strict `true`
          output: {
            ok: "yes",
            data: { slug: "concepts/x", frontmatter: null },
          },
        },
      ],
    } as unknown as MetisUIMessage;
    const { allowlist } = buildCitationContext([fuzzy]);
    expect(allowlist.has("concepts/x")).toBe(false);
  });
});
