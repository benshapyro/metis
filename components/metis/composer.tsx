"use client";
import { type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer({
  onSubmit,
  disabled,
}: {
  onSubmit: (t: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim() || disabled) {
      return;
    }
    onSubmit(text);
    setText("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="border-t p-3">
      <div className="mx-auto max-w-3xl flex gap-2">
        <Textarea
          className="min-h-[44px] max-h-48"
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask Metis… (Cmd/Ctrl+Enter to send)"
          value={text}
        />
        <Button disabled={disabled || !text.trim()} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
