"use client";
import { getToolName, isTextUIPart, isToolUIPart } from "ai";
import { useMemo } from "react";
import { Streamdown } from "streamdown";
import type { MetisUIMessage } from "@/lib/metis/agent";
import { buildCitationContext } from "@/lib/metis/citation-allowlist";
import { CitationProvider } from "./citation-context";
import { Brainlink, BrainlinkUnverified } from "./inline-citation";
import { remarkBrainlink } from "./remark-brainlink";
import { ToolStepPill } from "./tool-step-pill";

interface Props {
  message: MetisUIMessage;
  // Prior messages in the thread (ordered, excluding `message` itself). Their
  // tool outputs contribute to the allowlist so cross-turn synthesis queries
  // can cite pages retrieved in earlier turns without re-reading them.
  priorMessages?: MetisUIMessage[];
  onOpenSource: (slug: string) => void;
}

type ToolPillState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

const TOOL_LABELS: Record<string, string> = {
  search_pages: "Searching for",
  read_page: "Reading",
  read_frontmatter: "Peeking at",
  list_pages: "Listing",
  get_backlinks: "Walking backlinks from",
};

const TOOL_PAST_LABELS: Record<string, string> = {
  search_pages: "Search complete",
  read_page: "Read",
  read_frontmatter: "Peeked",
  list_pages: "Listed",
  get_backlinks: "Got backlinks",
};

// Map from AI SDK tool states to ToolStepPill states (drops 'output-denied')
const PILL_STATE_MAP: Record<string, ToolPillState | null> = {
  "input-streaming": "input-streaming",
  "input-available": "input-available",
  "output-available": "output-available",
  "output-error": "output-error",
  "output-denied": null,
};

export function AssistantMessage({
  message,
  priorMessages,
  onOpenSource,
}: Props) {
  const { allowlist, sourcesBySlug } = useMemo(
    () => buildCitationContext([...(priorMessages ?? []), message]),
    [message, priorMessages]
  );

  return (
    <CitationProvider
      allowlist={allowlist}
      onOpenSource={onOpenSource}
      sourcesBySlug={sourcesBySlug}
    >
      <div className="space-y-2">
        {/* Tool-step pills */}
        <div className="flex flex-wrap gap-1.5">
          {message.parts.map((p, i) => {
            if (!isToolUIPart(p)) {
              return null;
            }
            const name = getToolName(p);
            const pillState = PILL_STATE_MAP[p.state];
            if (!pillState) {
              return null;
            }
            const key = p.toolCallId ?? `tool-${i}`;

            if (pillState === "input-streaming") {
              return (
                <ToolStepPill
                  key={key}
                  label={`Calling ${name}...`}
                  name={name}
                  state="input-streaming"
                />
              );
            }
            if (pillState === "input-available") {
              const input = p.input as Record<string, unknown> | null;
              const arg = input?.slug ?? input?.query ?? input?.path ?? "";
              return (
                <ToolStepPill
                  key={key}
                  label={`${TOOL_LABELS[name] ?? name} ${String(arg)}`}
                  name={name}
                  state="input-available"
                />
              );
            }
            if (pillState === "output-available") {
              const out = p.output as
                | { ok?: boolean; reason?: string }
                | undefined;
              if (out && out.ok === false) {
                return (
                  <ToolStepPill
                    key={key}
                    label={`${name}: ${out.reason ?? "failed"}`}
                    name={name}
                    state="output-error"
                  />
                );
              }
              return (
                <ToolStepPill
                  key={key}
                  label={TOOL_PAST_LABELS[name] ?? name}
                  name={name}
                  state="output-available"
                />
              );
            }
            // output-error
            return (
              <ToolStepPill
                key={key}
                label={`${name} failed`}
                name={name}
                state="output-error"
              />
            );
          })}
        </div>
        {/* Text parts */}
        {message.parts.map((p, i) =>
          isTextUIPart(p) ? (
            <Streamdown
              components={{
                // remark-brainlink emits anchors with href="#brainlink-<encoded-slug>".
                // rehype-harden strips data-* attributes, so the href is the
                // single signal channel; the label is just the children text.
                a: (anchorProps) => {
                  const { href, children } = anchorProps;
                  if (
                    typeof href === "string" &&
                    href.startsWith("#brainlink-")
                  ) {
                    const slug = decodeURIComponent(
                      href.slice("#brainlink-".length)
                    );
                    const label = String(children ?? slug);
                    const verified = allowlist.has(slug);
                    return verified ? (
                      <Brainlink label={label} slug={slug} />
                    ) : (
                      <BrainlinkUnverified label={label} />
                    );
                  }
                  return (
                    <a href={href} rel="noopener noreferrer" target="_blank">
                      {children}
                    </a>
                  );
                },
              }}
              key={`text-${i}`}
              remarkPlugins={[[remarkBrainlink, { allowlist }]]}
            >
              {p.text}
            </Streamdown>
          ) : null
        )}
      </div>
    </CitationProvider>
  );
}
