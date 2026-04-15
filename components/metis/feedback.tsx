"use client";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Feedback({ messageId }: { messageId: string }) {
  const [rating, setRating] = useState<-1 | 0 | 1>(0);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (newRating: -1 | 0 | 1, newNote?: string) => {
    const previous = rating;
    setRating(newRating); // optimistic
    setPending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messageId,
          rating: newRating,
          note: newNote ?? null,
        }),
      });
      if (!res.ok) {
        setRating(previous); // revert on server error
        console.error("[feedback] server rejected rating:", res.status);
      }
    } catch (err) {
      setRating(previous); // revert on network error
      console.error("[feedback] network error:", err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <button
        aria-label="Rate helpful"
        className={cn("hover:text-green-600", rating === 1 && "text-green-600")}
        disabled={pending}
        onClick={() => submit(rating === 1 ? 0 : 1)}
        type="button"
      >
        <ThumbsUp className="size-4" />
      </button>
      <button
        aria-label="Rate unhelpful"
        className={cn("hover:text-red-500", rating === -1 && "text-red-500")}
        disabled={pending}
        onClick={() => submit(rating === -1 ? 0 : -1)}
        type="button"
      >
        <ThumbsDown className="size-4" />
      </button>
      {rating !== 0 && !noteOpen && (
        <button
          className="text-xs underline"
          onClick={() => setNoteOpen(true)}
          type="button"
        >
          add note
        </button>
      )}
      {noteOpen && (
        <input
          autoFocus
          className="text-xs border-b outline-none bg-transparent"
          onBlur={() => {
            if (note) {
              submit(rating, note);
            }
            setNoteOpen(false);
          }}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          value={note}
        />
      )}
    </div>
  );
}
