"use client";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  openSlug: string | null;
  onClose: () => void;
}

interface PageData {
  slug: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown> | null;
}

export function SourcePanel({ openSlug, onClose }: Props) {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openSlug) {
      setPage(null);
      setError(null);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPage(null); // clear stale content immediately when slug changes

    (async () => {
      try {
        const r = await fetch(`/api/pages/${encodeURIComponent(openSlug)}`, {
          signal: ac.signal,
        });
        if (cancelled) {
          return;
        }

        if (r.status === 404) {
          setError("This page no longer exists in the wiki.");
          return;
        }
        if (!r.ok) {
          let detail = `HTTP ${r.status}`;
          try {
            const body = await r.json();
            if (body?.error) {
              detail = String(body.error);
            }
          } catch {
            // body wasn't JSON; keep the HTTP status
          }
          if (r.status === 401) {
            setError("Your session expired. Please sign in again.");
          } else if (detail === "malformed") {
            setError(
              "This page has invalid frontmatter and cannot be displayed."
            );
          } else if (detail === "timeout") {
            setError("Loading this page timed out. Try again.");
          } else {
            setError(`Could not load source (${detail}).`);
          }
          return;
        }

        const p = (await r.json()) as PageData;
        if (!cancelled) {
          setPage(p);
        }
      } catch (err) {
        if (cancelled || (err as { name?: string })?.name === "AbortError") {
          return;
        }
        console.error("[SourcePanel] fetch failed", err);
        setError("Could not load source. Check your connection and try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [openSlug]);

  return (
    <Sheet
      onOpenChange={(o) => {
        if (!o) {
          onClose();
        }
      }}
      open={!!openSlug}
    >
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>{page?.title ?? openSlug ?? ""}</SheetTitle>
          {page?.frontmatter && (
            <SheetDescription>
              {String(page.frontmatter.type ?? "")} ·{" "}
              {String(page.frontmatter.domain ?? "")}
              {page.frontmatter.last_updated
                ? ` · Updated ${String(page.frontmatter.last_updated)}`
                : ""}
            </SheetDescription>
          )}
        </SheetHeader>
        {loading && (
          <div className="py-4 text-sm text-muted-foreground">Loading...</div>
        )}
        {error && <div className="py-4 text-sm text-amber-500">{error}</div>}
        {page && !error && (
          <div className="prose prose-sm dark:prose-invert mt-4">
            <Streamdown>{page.content}</Streamdown>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
