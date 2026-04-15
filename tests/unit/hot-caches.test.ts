import { beforeEach, describe, expect, it } from "vitest";
import { forceReloadHotCaches, loadHotCaches } from "@/lib/metis/hot-caches";

describe("hot-caches", () => {
  beforeEach(() => forceReloadHotCaches());

  it("loads all five files from _meta", async () => {
    const hc = await loadHotCaches();
    expect(hc.index).toContain("Wiki Index");
    expect(hc.practice.length).toBeGreaterThan(0);
    expect(hc.research.length).toBeGreaterThan(0);
    expect(hc.clients.length).toBeGreaterThan(0);
    expect(hc.personal.length).toBeGreaterThan(0);
    expect(hc.totalChars).toBe(
      hc.index.length +
        hc.practice.length +
        hc.research.length +
        hc.clients.length +
        hc.personal.length
    );
  });

  it("memoizes on second call", async () => {
    const a = await loadHotCaches();
    const b = await loadHotCaches();
    expect(a).toBe(b); // same object reference
  });

  it("does not memoize broken state on failure", async () => {
    // Save real WIKI_ROOT, point at a nonexistent dir, expect throw, restore.
    const prev = process.env.WIKI_ROOT;
    process.env.WIKI_ROOT = "/nonexistent-metis-test-root";
    forceReloadHotCaches(); // clear
    await expect(loadHotCaches()).rejects.toThrow();
    process.env.WIKI_ROOT = prev;
    forceReloadHotCaches();
    const hc = await loadHotCaches();
    expect(hc.index.length).toBeGreaterThan(0);
  });
});
