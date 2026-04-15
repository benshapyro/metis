import { createAgentUIStreamResponse } from "ai";
import { auth } from "@/app/(auth)/auth";
import { deleteChatById, getChatById } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { type MetisAgent, makeMetisAgent } from "@/lib/metis/agent";

// Node runtime required: tools spawn pure-JS file walks via fs.readFile.
// maxDuration tied to stopWhen: stepCountIs(12) in agent.ts — keep them aligned;
// raising the step cap without bumping maxDuration causes mid-stream timeouts.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  let messages: unknown[];
  try {
    const body = await request.json();
    if (!Array.isArray(body?.messages)) {
      return new ChatbotError(
        "bad_request:api",
        "messages must be an array"
      ).toResponse();
    }
    messages = body.messages;
  } catch (err) {
    console.error("[chat.POST] failed to parse request body:", err);
    return new ChatbotError("bad_request:api", String(err)).toResponse();
  }

  let agent: MetisAgent;
  try {
    agent = await makeMetisAgent();
  } catch (err) {
    console.error("[chat.POST] makeMetisAgent failed:", err);
    return new ChatbotError("offline:chat", String(err)).toResponse();
  }

  try {
    return createAgentUIStreamResponse({ agent, uiMessages: messages });
  } catch (err) {
    console.error("[chat.POST] createAgentUIStreamResponse failed:", err);
    return new ChatbotError("offline:chat", String(err)).toResponse();
  }
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
