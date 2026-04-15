import { describe, it, expect } from 'vitest';
import {
  wikiRoot,
  safeReadMarkdown,
  parseFrontmatter,
  parseReferencedBy,
  pageExists,
  resolveSlug,
} from '@/lib/metis/wiki';

describe('wiki helpers', () => {
  it('wikiRoot resolves from env', () => {
    expect(wikiRoot()).toMatch(/tests\/fixtures\/wiki$/);
  });

  it('resolveSlug finds top-level page', () => {
    expect(resolveSlug('shaping-overview')).toMatch(/practice\/shaping-overview\.md$/);
  });

  it('resolveSlug finds nested page', () => {
    expect(resolveSlug('acme/engagement-notes')).toMatch(/clients\/acme\/engagement-notes\.md$/);
  });

  it('resolveSlug returns null for missing', () => {
    expect(resolveSlug('does-not-exist')).toBeNull();
  });

  it('pageExists detects presence', () => {
    expect(pageExists('shaping-overview')).toBe(true);
    expect(pageExists('does-not-exist')).toBe(false);
  });

  it('safeReadMarkdown returns content for a real slug', async () => {
    const md = await safeReadMarkdown('shaping-overview');
    expect(md).toContain('Shaping Overview');
  });

  it('safeReadMarkdown returns null for missing', async () => {
    expect(await safeReadMarkdown('missing')).toBeNull();
  });

  it('parseFrontmatter parses valid YAML', () => {
    const content = '---\ntitle: T\ntype: concept\n---\n\nbody';
    const out = parseFrontmatter(content);
    expect(out.frontmatter).toEqual({ title: 'T', type: 'concept' });
    expect(out.body).toBe('body');
  });

  it('parseFrontmatter returns null frontmatter on malformed YAML', () => {
    const content = '---\ntitle: [unclosed\n---\n\nbody';
    const out = parseFrontmatter(content);
    expect(out.frontmatter).toBeNull();
    expect(out.body).toBe('body');
  });

  it('parseFrontmatter handles missing frontmatter', () => {
    const content = 'no frontmatter here';
    const out = parseFrontmatter(content);
    expect(out.frontmatter).toBeNull();
    expect(out.body).toBe('no frontmatter here');
  });

  it('parseReferencedBy extracts wikilinks', () => {
    const content = `# Page\n\n## Referenced By\n- [[a]]\n- [[b/c]]\n- [[d]] – note\n`;
    expect(parseReferencedBy(content)).toEqual(['a', 'b/c', 'd']);
  });

  it('parseReferencedBy returns empty array when section absent', () => {
    expect(parseReferencedBy('# Page\n\nno section')).toEqual([]);
  });
});
