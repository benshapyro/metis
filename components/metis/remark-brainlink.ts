// components/metis/remark-brainlink.ts

import type { PhrasingContent, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export interface RemarkBrainlinkOptions {
  allowlist: Set<string>;
}

const BRAINLINK_RE = /\[\[([^\]\n|]+?)(?:\|([^\]\n]*))?\]\]/g;

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
        const brainlink: any = {
          type: verified ? "brainlink" : "brainlinkUnverified",
          slug,
          text: label,
          data: {
            hName: verified ? "brainlink" : "brainlink-unverified",
            hProperties: { slug, label, verified },
          },
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
