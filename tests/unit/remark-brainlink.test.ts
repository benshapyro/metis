import { describe, it, expect } from 'vitest';
import { remark } from 'remark';
import { remarkBrainlink } from '@/components/metis/remark-brainlink';
import { visit } from 'unist-util-visit';

function tree(md: string, allowlist: Set<string>) {
  const file = remark().use(remarkBrainlink, { allowlist }).parse(md);
  return remark().use(remarkBrainlink, { allowlist }).runSync(file) as any;
}

function collect(md: string, allowlist: Set<string>) {
  const out: Array<{ type: string; slug?: string; text: string }> = [];
  visit(tree(md, allowlist), (node: any) => {
    if (node.type === 'brainlink' || node.type === 'brainlinkUnverified') {
      out.push({ type: node.type, slug: node.slug, text: node.text ?? '' });
    }
  });
  return out;
}

describe('remarkBrainlink', () => {
  it('transforms [[slug]] into a brainlink node when allowed', () => {
    const hits = collect('See [[shaping-overview]].', new Set(['shaping-overview']));
    expect(hits).toEqual([
      { type: 'brainlink', slug: 'shaping-overview', text: 'shaping-overview' },
    ]);
  });

  it('marks unverified when slug is not in allowlist', () => {
    const hits = collect('See [[not-a-real-page]].', new Set(['shaping-overview']));
    expect(hits).toEqual([
      { type: 'brainlinkUnverified', slug: 'not-a-real-page', text: 'not-a-real-page' },
    ]);
  });

  it('handles multiple adjacent citations', () => {
    const hits = collect('[[a]][[b]][[c]]', new Set(['a', 'c']));
    expect(hits.map((h) => h.type)).toEqual([
      'brainlink',
      'brainlinkUnverified',
      'brainlink',
    ]);
  });

  it('leaves non-matching double brackets alone', () => {
    const hits = collect('No brainlink in [[]] or [[ ]] or `[[code]]`', new Set());
    expect(hits).toEqual([]);
  });

  it('supports slashed slugs', () => {
    const hits = collect('[[clients/acme/engagement-notes]]', new Set(['clients/acme/engagement-notes']));
    expect(hits).toEqual([
      { type: 'brainlink', slug: 'clients/acme/engagement-notes', text: 'clients/acme/engagement-notes' },
    ]);
  });

  it('supports pipe alias [[slug|Display]]', () => {
    const hits = collect('See [[shaping-overview|the shaping framework]].', new Set(['shaping-overview']));
    expect(hits).toEqual([
      { type: 'brainlink', slug: 'shaping-overview', text: 'the shaping framework' },
    ]);
  });
});
