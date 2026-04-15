'use client';
import { useMemo } from 'react';
import {
  getToolName,
  isStaticToolUIPart,
  isTextUIPart,
  isToolUIPart,
} from 'ai';
import { Streamdown } from 'streamdown';
import type { MetisUIMessage } from '@/lib/metis/agent';
import { remarkBrainlink } from './remark-brainlink';
import { Brainlink, BrainlinkUnverified } from './inline-citation';
import { CitationProvider, type CitationSource } from './citation-context';
import { ToolStepPill } from './tool-step-pill';

interface Props {
  message: MetisUIMessage;
  onOpenSource: (slug: string) => void;
}

type ToolPillState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

const TOOL_LABELS: Record<string, string> = {
  search_pages: 'Searching for',
  read_page: 'Reading',
  read_frontmatter: 'Peeking at',
  list_pages: 'Listing',
  get_backlinks: 'Walking backlinks from',
};

const TOOL_PAST_LABELS: Record<string, string> = {
  search_pages: 'Search complete',
  read_page: 'Read',
  read_frontmatter: 'Peeked',
  list_pages: 'Listed',
  get_backlinks: 'Got backlinks',
};

// Map from AI SDK tool states to ToolStepPill states (drops 'output-denied')
const PILL_STATE_MAP: Record<string, ToolPillState | null> = {
  'input-streaming': 'input-streaming',
  'input-available': 'input-available',
  'output-available': 'output-available',
  'output-error': 'output-error',
  'output-denied': null,
};

export function AssistantMessage({ message, onOpenSource }: Props) {
  // Build per-turn allowlist + sources lookup from static tool parts.
  const { allowlist, sourcesBySlug } = useMemo(() => {
    const allow = new Set<string>();
    const sources: Record<string, CitationSource> = {};
    for (const p of message.parts) {
      if (!isStaticToolUIPart(p)) continue;
      const name = String(getToolName(p));
      if (
        (name === 'read_page' || name === 'read_frontmatter') &&
        p.state === 'output-available'
      ) {
        const out = p.output as {
          ok: boolean;
          data?: { slug: string; frontmatter: Record<string, unknown> | null };
        };
        if (out?.ok && out.data && !sources[out.data.slug]) {
          allow.add(out.data.slug);
          sources[out.data.slug] = {
            slug: out.data.slug,
            title: (out.data.frontmatter?.title as string | undefined) ?? out.data.slug,
            confidence: out.data.frontmatter?.confidence as string | undefined,
          };
        }
      }
    }
    return { allowlist: allow, sourcesBySlug: sources };
  }, [message.parts]);

  return (
    <CitationProvider
      allowlist={allowlist}
      sourcesBySlug={sourcesBySlug}
      onOpenSource={onOpenSource}
    >
      <div className="space-y-2">
        {/* Tool-step pills */}
        <div className="flex flex-wrap gap-1.5">
          {message.parts.map((p, i) => {
            if (!isToolUIPart(p)) return null;
            const name = getToolName(p);
            const pillState = PILL_STATE_MAP[p.state];
            if (!pillState) return null;

            if (pillState === 'input-streaming') {
              return (
                <ToolStepPill
                  key={i}
                  name={name}
                  state="input-streaming"
                  label={`Calling ${name}...`}
                />
              );
            }
            if (pillState === 'input-available') {
              const input = p.input as Record<string, unknown> | null;
              const arg = input?.slug ?? input?.query ?? input?.path ?? '';
              return (
                <ToolStepPill
                  key={i}
                  name={name}
                  state="input-available"
                  label={`${TOOL_LABELS[name] ?? name} ${String(arg)}`}
                />
              );
            }
            if (pillState === 'output-available') {
              return (
                <ToolStepPill
                  key={i}
                  name={name}
                  state="output-available"
                  label={TOOL_PAST_LABELS[name] ?? name}
                />
              );
            }
            // output-error
            return (
              <ToolStepPill
                key={i}
                name={name}
                state="output-error"
                label={`${name} failed`}
              />
            );
          })}
        </div>
        {/* Text parts */}
        {message.parts.map((p, i) =>
          isTextUIPart(p) ? (
            <Streamdown
              key={i}
              remarkPlugins={[[remarkBrainlink, { allowlist }]]}
              components={{
                brainlink: ({
                  slug,
                  label,
                }: Record<string, unknown> & { node?: unknown }) => (
                  <Brainlink slug={String(slug)} label={String(label)} />
                ),
                'brainlink-unverified': ({
                  label,
                }: Record<string, unknown> & { node?: unknown }) => (
                  <BrainlinkUnverified label={String(label)} />
                ),
              }}
            >
              {p.text}
            </Streamdown>
          ) : null,
        )}
      </div>
    </CitationProvider>
  );
}
