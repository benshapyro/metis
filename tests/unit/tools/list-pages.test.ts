import { describe, it, expect } from 'vitest';
import { listPages } from '@/lib/metis/tools/list-pages';

describe('list_pages', () => {
  it('lists pages in a path', async () => {
    const r = await listPages({ path: 'practice' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toContain('shaping-overview');
      expect(r.data.length).toBeGreaterThan(0);
    }
  });

  it('filters by substring', async () => {
    const r = await listPages({ path: 'practice', filter: 'shap' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(['shaping-overview']);
  });

  it('empty data is not an error', async () => {
    const r = await listPages({ path: 'practice', filter: 'zzz' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });

  it('not_found when path does not exist', async () => {
    const r = await listPages({ path: 'nonexistent-domain' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});
