import { describe, it, expect } from 'vitest';
import { systemPromptString } from '@/lib/metis/prompt';

describe('prompt builder', () => {
  it('includes identity, voice, and hot caches', async () => {
    const s = await systemPromptString();
    expect(s).toContain('You are Metis');
    expect(s).toContain('mirror Ben Shapiro');
    expect(s).toContain('Wiki Index');
    expect(s).toContain('Hot Caches');
    expect(s.length).toBeGreaterThan(2000);
  });
});
