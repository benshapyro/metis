import { describe, expect, it } from "vitest";
import { searchPages } from "@/lib/metis/tools/search-pages";

describe("search_pages", () => {
  it("finds a page by title keyword", async () => {
    const r = await searchPages({ query: "shaping" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.length).toBeGreaterThan(0);
      expect(r.data[0].slug).toBe("shaping-overview");
      expect(r.data[0].score).toBeGreaterThan(0);
    }
  });

  it("finds a page by tag", async () => {
    const r = await searchPages({ query: "methodology" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.map((x) => x.slug)).toContain("shaping-overview");
    }
  });

  it("returns [] with ok:true when no match", async () => {
    const r = await searchPages({ query: "zzzxxxqqq" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual([]);
    }
  });

  it("respects limit", async () => {
    const r = await searchPages({ query: "Acme", limit: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.length).toBeLessThanOrEqual(1);
    }
  });

  it("returns hits sorted by score (tag matches outrank body matches)", async () => {
    // 'methodology' is a tag on shaping-overview; should rank high.
    const r = await searchPages({ query: "methodology" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0]?.slug).toBe("shaping-overview");
      expect(r.data[0]?.score).toBeGreaterThanOrEqual(3);
    }
  });
});
