'use client';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationText,
} from '@/components/ai-elements/inline-citation';
import { useCitationContext } from './citation-context';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// InlineCitationCardTrigger expects a `sources: string[]` prop (badge trigger).
// We repurpose it by passing a single-element array with the slug as the "url".
// The onClick is added to the outer InlineCitation wrapper via a custom button.

export function Brainlink({ slug, label }: { slug: string; label: string }) {
  const { sourcesBySlug, onOpenSource } = useCitationContext();
  const src = sourcesBySlug[slug];
  const confidenceWeak = src?.confidence === 'auto-ingested';
  const coverageWeak = src?.coverage === 'low';

  return (
    <InlineCitation>
      <InlineCitationText>{label}</InlineCitationText>
      <InlineCitationCard>
        <InlineCitationCardTrigger
          sources={[slug]}
          onClick={() => onOpenSource(slug)}
          className={cn(
            'cursor-pointer',
            (confidenceWeak || coverageWeak) && 'ring-1 ring-amber-400/60',
          )}
          aria-label={`Open source ${src?.title ?? slug}`}
        />
        <InlineCitationCardBody>
          <div className="space-y-1 p-3 text-xs">
            <div className="font-medium">{src?.title ?? slug}</div>
            {src?.confidence && (
              <div className="text-muted-foreground">Confidence: {src.confidence}</div>
            )}
            {coverageWeak && (
              <div className="text-amber-500">Coverage: low</div>
            )}
          </div>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

export function BrainlinkUnverified({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1 rounded bg-amber-500/10 text-amber-600 text-[0.9em]"
      title="This citation wasn't verified against a retrieved source."
      aria-label="Unverified citation"
    >
      <AlertTriangle className="size-3" />
      {label}
    </span>
  );
}
