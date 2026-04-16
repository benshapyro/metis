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

  // Guard submission during both "submitted" (request sent, no chunks yet) and
  // "streaming" phases to prevent duplicate user turns from rapid double-clicks.
  const busy = status === "submitted" || status === "streaming";

  const submit = (text: string) => {
    if (!text.trim() || busy) {
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
              {messages.map((m, i) => {
                const msg = m as MetisUIMessage;
                // Skip empty assistant turns (stream errored before any
                // parts emitted — e.g., Gateway "Insufficient funds"). Without
                // this we render an empty bubble with orphan rate buttons.
                if (
                  msg.role === "assistant" &&
                  (!msg.parts || msg.parts.length === 0)
                ) {
                  return null;
                }
                // Prior assistant messages feed the cross-turn allowlist so
                // pages read in earlier turns still render as verified pills.
                const priorAssistant = messages
                  .slice(0, i)
                  .filter((x) => x.role === "assistant") as MetisUIMessage[];
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
                          priorMessages={priorAssistant}
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
              {busy && (
                <div className="text-xs text-muted-foreground">
                  Metis is thinking…
                </div>
              )}
            </div>
          )}
        </main>
        <Composer disabled={busy} onSubmit={submit} />
      </div>

      <SourcePanel onClose={() => setOpenSource(null)} openSlug={openSource} />
      <DataStreamHandler />
    </>
  );
}
