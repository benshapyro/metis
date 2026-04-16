// components/metis/remark-brainlink.ts

import type { PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { BRAINLINK_RE } from "@/lib/metis/brainlink-syntax";

export interface RemarkBrainlinkOptions {
  allowlist: Set<string>;
}

export const remarkBrainlink: Plugin<[RemarkBrainlinkOptions], Root> = ({
  allowlist,
}) => {
  return (tree) => {
    visit(tree, "text", (node: Text, index, parent: any) => {
      if (!parent || index == null) {
        return;
      }
      const value = node.value;
      if (!value.includes("[[")) {
        return;
      }
      BRAINLINK_RE.lastIndex = 0;
      const children: PhrasingContent[] = [];
      let lastEnd = 0;
      for (const m of value.matchAll(BRAINLINK_RE)) {
        const start = m.index ?? 0;
        const slug = m[1].trim();
        const label = (m[2] ?? slug).trim();
        if (!slug) {
          continue;
        }
        if (start > lastEnd) {
          children.push({
            type: "text",
            value: value.slice(lastEnd, start),
          } as Text);
        }
        const verified = allowlist.has(slug);
        // Use a custom mdast type (NOT "link") so Streamdown's URL sanitizer
        // doesn't run on it. `hName: 'a'` renders as <a>, standard HTML that
        // survives rehype-harden. The href encodes the slug as a same-origin
        // fragment — components.a in message.tsx detects the `#brainlink-`
        // prefix + children text (the label) and renders our Brainlink /
        // BrainlinkUnverified. rehype-harden strips unknown data-* attributes,
        // so we can't use them; the href itself is the signal channel.
        const href = `#brainlink-${encodeURIComponent(slug)}`;
        const brainlink: any = {
          type: "brainlink",
          data: {
            hName: "a",
            hProperties: { href },
            // Round-trip hints for internal consumers (tests, persistence
            // layer) that walk the mdast tree before hast conversion.
            slug,
            label,
            verified,
          },
          children: [{ type: "text", value: label }],
        };
        children.push(brainlink as PhrasingContent);
        lastEnd = start + m[0].length;
      }
      if (lastEnd === 0) {
        return;
      } // no matches
      if (lastEnd < value.length) {
        children.push({ type: "text", value: value.slice(lastEnd) } as Text);
      }
      parent.children.splice(index, 1, ...children);
      return index + children.length;
    });
  };
};
