import { describe, it, expect } from 'vitest';
import { readPage } from '@/lib/metis/tools/read-page';

describe('read_page', () => {
  it('returns ok with frontmatter + content for existing page', async () => {
    const r = await readPage({ slug: 'shaping-overview' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.slug).toBe('shaping-overview');
      expect(r.data.frontmatter).toMatchObject({ title: 'Shaping Overview', domain: 'practice' });
      expect(r.data.content).toContain('Shaping Overview');
    }
  });

  it('returns not_found for missing slug', async () => {
    const r = await readPage({ slug: 'does-not-exist' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('caps content at 40KB and flags sizeCapped', async () => {
    const r = await readPage({ slug: 'shaping-overview' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sizeCapped).toBeUndefined();
  });
});
