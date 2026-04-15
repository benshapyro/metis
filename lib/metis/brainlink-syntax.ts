// lib/metis/brainlink-syntax.ts — shared [[slug]] regex and parser.
// Import BRAINLINK_RE or parseBrainlinks instead of duplicating the regex.
export const BRAINLINK_RE = /\[\[([^\]\n|]+?)(?:\|([^\]\n]*))?\]\]/g;

export interface ParsedBrainlink {
  slug: string;
  label: string;
}

export function* parseBrainlinks(text: string): Generator<ParsedBrainlink> {
  for (const m of text.matchAll(BRAINLINK_RE)) {
    const slug = m[1].trim();
    const label = (m[2] ?? slug).trim();
    if (!slug) {
      continue;
    }
    yield { slug, label };
  }
}
