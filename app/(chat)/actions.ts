"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { titleModel } from "@/lib/ai/models";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text } = await generateText({
    model: getTitleModel(),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
    providerOptions: {
      gateway: { order: titleModel.gatewayOrder },
    },
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

// Stub kept for message-editor.tsx (Phase 7 will wire to thread/message tables).
// For now this is a no-op so the UI doesn't break during Phase 6.
export async function deleteTrailingMessages({ id: _id }: { id: string }) {
  // Phase 7: look up message by id, verify ownership, delete messages after it.
}

// Stub kept for use-chat-visibility.ts (Phase 7 concern — threads don't have
// a visibility field in v1, so this becomes a no-op until the UI is updated).
export async function updateChatVisibility({
  chatId: _chatId,
  visibility: _visibility,
}: {
  chatId: string;
  visibility: "public" | "private";
}) {
  // Phase 7: threads do not have visibility in v1. No-op.
}
