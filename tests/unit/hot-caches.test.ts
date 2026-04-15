import { describe, it, expect, beforeEach } from 'vitest';
import { loadHotCaches, forceReloadHotCaches } from '@/lib/metis/hot-caches';

describe('hot-caches', () => {
  beforeEach(() => forceReloadHotCaches());

  it('loads all five files from _meta', async () => {
    const hc = await loadHotCaches();
    expect(hc.index).toContain('Wiki Index');
    expect(hc.practice.length).toBeGreaterThan(0);
    expect(hc.research.length).toBeGreaterThan(0);
    expect(hc.clients.length).toBeGreaterThan(0);
    expect(hc.personal.length).toBeGreaterThan(0);
    expect(hc.total_chars).toBe(
      hc.index.length + hc.practice.length + hc.research.length + hc.clients.length + hc.personal.length,
    );
  });

  it('memoizes on second call', async () => {
    const a = await loadHotCaches();
    const b = await loadHotCaches();
    expect(a).toBe(b); // same object reference
  });
});
