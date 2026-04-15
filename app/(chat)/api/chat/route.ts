import { createAgentUIStreamResponse } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { makeMetisAgent } from "@/lib/metis/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  let messages: unknown[];
  try {
    const body = await request.json();
    messages = body.messages ?? [];
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const agent = await makeMetisAgent();

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
