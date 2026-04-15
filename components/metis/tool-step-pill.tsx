"use client";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  label: ReactNode;
}

const ICONS: Record<string, string> = {
  search_pages: "🔍",
  read_page: "📄",
  read_frontmatter: "👁",
  list_pages: "📂",
  get_backlinks: "🔗",
};

export function ToolStepPill({ name, state, label }: Props) {
  const icon = ICONS[name] ?? "•";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
        state === "input-streaming" &&
          "border-muted-foreground/20 text-muted-foreground/60",
        state === "input-available" && "border-primary/40 text-primary",
        state === "output-available" && "border-green-600/40 text-green-600/80",
        state === "output-error" && "border-amber-500/60 text-amber-600"
      )}
    >
      <span>{icon}</span>
      {state === "input-available" && (
        <Loader2 className="size-3 animate-spin" />
      )}
      {state === "output-available" && <Check className="size-3" />}
      {state === "output-error" && <AlertTriangle className="size-3" />}
      <span>{label}</span>
    </span>
  );
}
