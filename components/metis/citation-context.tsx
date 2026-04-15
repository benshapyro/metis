"use client";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface CitationSource {
  slug: string;
  title?: string;
  confidence?: string;
  coverage?: "low" | "medium" | "high";
}

interface CitationContextValue {
  /** Slugs the agent has actually retrieved in this assistant turn. */
  allowlist: Set<string>;
  /** Lookup for richer source metadata once pages are read. */
  sourcesBySlug: Record<string, CitationSource>;
  /** Called when a citation is clicked in the message. */
  onOpenSource: (slug: string) => void;
}

const Ctx = createContext<CitationContextValue | null>(null);

export function CitationProvider({
  allowlist,
  sourcesBySlug,
  onOpenSource,
  children,
}: CitationContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ allowlist, sourcesBySlug, onOpenSource }),
    [allowlist, sourcesBySlug, onOpenSource]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCitationContext(): CitationContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      "useCitationContext must be used within a CitationProvider"
    );
  }
  return v;
}
