import { describe, it, expect } from 'vitest';
import { readFrontmatter } from '@/lib/metis/tools/read-frontmatter';

describe('read_frontmatter', () => {
  it('returns frontmatter + first paragraph for existing page', async () => {
    const r = await readFrontmatter({ slug: 'shaping-overview' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.frontmatter).toMatchObject({ domain: 'practice' });
      expect(r.data.first_paragraph.length).toBeGreaterThan(0);
      expect(r.data.first_paragraph).not.toContain('## Referenced By');
    }
  });

  it('returns not_found for missing', async () => {
    const r = await readFrontmatter({ slug: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});
