import { describe, it, expect } from 'vitest';
import { getBacklinks } from '@/lib/metis/tools/get-backlinks';

describe('get_backlinks', () => {
  it('returns slugs from Referenced By section', async () => {
    const r = await getBacklinks({ slug: 'shaping-overview' });
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.data].sort()).toEqual(['ai-adoption', 'synthesis']);
  });

  it('returns [] when section is absent or empty', async () => {
    const r = await getBacklinks({ slug: 'user-manual' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });

  it('not_found for missing slug', async () => {
    const r = await getBacklinks({ slug: 'nope' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});
