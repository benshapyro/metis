import { describe, it, expect } from 'vitest';
import { remark } from 'remark';
import { remarkBrainlink } from '@/components/metis/remark-brainlink';
import { visit } from 'unist-util-visit';

function tree(md: string, allowlist: Set<string>) {
  const file = remark().use(remarkBrainlink, { allowlist }).parse(md);
  return remark().use(remarkBrainlink, { allowlist }).runSync(file) as any;
}

interface BrainlinkHit {
  verified: boolean;
  slug: string;
  label: string;
}

function collect(md: string, allowlist: Set<string>): BrainlinkHit[] {
  const out: BrainlinkHit[] = [];
  visit(tree(md, allowlist), (node: any) => {
    // remark-brainlink emits mdast nodes of type `brainlink` with
    // data.hName='a', data.hProperties.href='#brainlink-<slug>', and
    // data.{slug,label,verified} round-tripped for internal consumers.
    if (node.type !== 'brainlink') return;
    out.push({
      verified: node.data?.verified === true,
      slug: node.data?.slug ?? '',
      label: node.data?.label ?? '',
    });
  });
  return out;
}

describe('remarkBrainlink', () => {
  it('transforms [[slug]] into a verified brainlink anchor when allowed', () => {
    const hits = collect('See [[shaping-overview]].', new Set(['shaping-overview']));
    expect(hits).toEqual([
      { verified: true, slug: 'shaping-overview', label: 'shaping-overview' },
    ]);
  });

  it('marks unverified when slug is not in allowlist', () => {
    const hits = collect('See [[not-a-real-page]].', new Set(['shaping-overview']));
    expect(hits).toEqual([
      { verified: false, slug: 'not-a-real-page', label: 'not-a-real-page' },
    ]);
  });

  it('handles multiple adjacent citations', () => {
    const hits = collect('[[a]][[b]][[c]]', new Set(['a', 'c']));
    expect(hits.map((h) => h.verified)).toEqual([true, false, true]);
  });

  it('leaves non-matching double brackets alone', () => {
    const hits = collect('No brainlink in [[]] or [[ ]] or `[[code]]`', new Set());
    expect(hits).toEqual([]);
  });

  it('supports slashed slugs', () => {
    const hits = collect('[[clients/acme/engagement-notes]]', new Set(['clients/acme/engagement-notes']));
    expect(hits).toEqual([
      {
        verified: true,
        slug: 'clients/acme/engagement-notes',
        label: 'clients/acme/engagement-notes',
      },
    ]);
  });

  it('supports pipe alias [[slug|Display]]', () => {
    const hits = collect('See [[shaping-overview|the shaping framework]].', new Set(['shaping-overview']));
    expect(hits).toEqual([
      { verified: true, slug: 'shaping-overview', label: 'the shaping framework' },
    ]);
  });
});
