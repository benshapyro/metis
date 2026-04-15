"use client";

import { useState } from "react";
import { Composer } from "@/components/metis/composer";
import { Feedback } from "@/components/metis/feedback";
import { AssistantMessage } from "@/components/metis/message";
import { SourcePanel } from "@/components/metis/source-panel";
import { Welcome } from "@/components/metis/welcome";
import { useActiveChat } from "@/hooks/use-active-chat";
import type { MetisUIMessage } from "@/lib/metis/agent";
import { DataStreamHandler } from "./data-stream-handler";

export function ChatShell() {
  const { messages, sendMessage, status } = useActiveChat();
  const [openSource, setOpenSource] = useState<string | null>(null);

  const submit = (text: string) => {
    if (!text.trim() || status === "streaming") {
      return;
    }
    sendMessage({ role: "user" as const, parts: [{ type: "text", text }] });
  };

  return (
    <>
      <div className="flex flex-col h-dvh w-full">
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <Welcome onStart={submit} />
          ) : (
            <div className="mx-auto max-w-3xl p-4 space-y-6">
              {messages.map((m) => {
                const msg = m as MetisUIMessage;
                return (
                  <div className="space-y-2" key={msg.id}>
                    <div className="text-xs uppercase text-muted-foreground">
                      {msg.role}
                    </div>
                    {msg.role === "assistant" ? (
                      <>
                        <AssistantMessage
                          message={msg}
                          onOpenSource={setOpenSource}
                        />
                        <Feedback messageId={msg.id} />
                      </>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert">
                        {msg.parts.map((p, i) =>
                          p.type === "text" ? (
                            <p key={i}>
                              {(p as { type: "text"; text: string }).text}
                            </p>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {status === "streaming" && (
                <div className="text-xs text-muted-foreground">
                  Metis is thinking…
                </div>
              )}
            </div>
          )}
        </main>
        <Composer disabled={status === "streaming"} onSubmit={submit} />
      </div>

      <SourcePanel onClose={() => setOpenSource(null)} openSlug={openSource} />
      <DataStreamHandler />
    </>
  );
}
