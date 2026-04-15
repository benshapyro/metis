import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPage } from "@/lib/metis/tools/read-page";

const FIXTURE_DIR = path.resolve(__dirname, "../../fixtures/wiki/practice");
const LARGE_SLUG = "oversized-test-page";
const LARGE_PATH = path.join(FIXTURE_DIR, `${LARGE_SLUG}.md`);

describe("read_page", () => {
  beforeAll(async () => {
    // Generate a 50KB+ body so we exercise the 40KB cap.
    const filler = "x".repeat(50 * 1024);
    const content = `---\ntitle: Oversized Test\ntype: source\ndomain: practice\n---\n\n${filler}\n\n## Referenced By\n`;
    await fs.writeFile(LARGE_PATH, content, "utf8");
  });
  afterAll(async () => {
    await fs.unlink(LARGE_PATH).catch(() => {
      // file already gone — ignore
    });
  });

  it("returns ok with frontmatter + content for existing page", async () => {
    const r = await readPage({ slug: "shaping-overview" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.slug).toBe("shaping-overview");
      expect(r.data.frontmatter).toMatchObject({
        title: "Shaping Overview",
        domain: "practice",
      });
      expect(r.data.content).toContain("Shaping Overview");
      expect(r.data.content).not.toContain("---"); // proves frontmatter stripped
    }
  });

  it("returns not_found for missing slug", async () => {
    const r = await readPage({ slug: "does-not-exist" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("not_found");
    }
  });

  it("does NOT flag sizeCapped for a small page", async () => {
    const r = await readPage({ slug: "shaping-overview" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sizeCapped).toBeUndefined();
    }
  });

  it("flags sizeCapped + truncates body for a >40KB page", async () => {
    const r = await readPage({ slug: LARGE_SLUG });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sizeCapped).toBe(true);
      // Body cap is 40KB
      expect(r.data.content.length).toBeLessThanOrEqual(40 * 1024);
      // Frontmatter should still parse (we now parse before truncating)
      expect(r.data.frontmatter).toMatchObject({ title: "Oversized Test" });
    }
  });
});
