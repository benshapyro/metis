"use client";

// use-chat-visibility — stub for Metis v1.
// Threads don't have a visibility field in v1; this hook is a no-op until Phase 7.
import type { VisibilityType } from "@/components/chat/visibility-selector";

export function useChatVisibility({
  chatId: _chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  return {
    visibilityType: initialVisibilityType,
    setVisibilityType: (_type: VisibilityType) => {
      // Phase 7: wire to /api/threads/[threadId] PATCH or similar.
    },
  };
}
