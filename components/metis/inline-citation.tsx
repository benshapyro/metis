"use client";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitationContext } from "./citation-context";

// Small custom pill (not ai-elements' InlineCitationCardTrigger — that one
// does `new URL(sources[0]).hostname` which fails on wiki slugs like
// `concepts/context-engineering`). Pure Tailwind + native <button>; hover
// uses the standard title attribute, click opens the source panel.

export function Brainlink({ slug, label }: { slug: string; label: string }) {
  const { sourcesBySlug, onOpenSource } = useCitationContext();
  const src = sourcesBySlug[slug];
  const confidenceWeak = src?.confidence === "auto-ingested";
  const coverageWeak = src?.coverage === "low";
  const tooltip = [
    src?.title ?? slug,
    src?.confidence && `(${src.confidence})`,
    coverageWeak && "coverage: low",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-label={`Open source ${src?.title ?? slug}`}
      className={cn(
        "mx-0.5 inline-flex items-baseline rounded-sm border px-1 py-0.5 text-[0.85em] leading-tight",
        "border-primary/30 bg-primary/5 text-primary",
        "transition-colors hover:bg-primary/10 hover:border-primary/50",
        (confidenceWeak || coverageWeak) && "ring-1 ring-amber-400/60",
      )}
      onClick={() => onOpenSource(slug)}
      title={tooltip}
      type="button"
    >
      {label}
    </button>
  );
}

export function BrainlinkUnverified({ label }: { label: string }) {
  return (
    <span
      className="mx-0.5 inline-flex items-center gap-0.5 rounded-sm bg-amber-500/10 px-1 py-0.5 text-[0.85em] text-amber-600"
      title="This citation wasn't verified against a retrieved source."
    >
      <AlertTriangle className="size-3" />
      {label}
    </span>
  );
}
