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
    setLoading(true);
    setError(null);
    fetch(`/api/pages/${encodeURIComponent(openSlug)}`)
      .then((r) => {
        if (r.status === 404) {
          setError("This page no longer exists in the wiki.");
          return null;
        }
        if (!r.ok) {
          setError("Failed to load source.");
          return null;
        }
        return r.json() as Promise<PageData>;
      })
      .then((p) => {
        if (p) {
          setPage(p);
        }
      })
      .finally(() => setLoading(false));
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
