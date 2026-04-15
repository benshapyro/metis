// /api/messages — fetch messages for a thread.
// Replaces the old chat-based messages endpoint.
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { message, thread } from "@/lib/db/schema";
import { convertToUIMessages } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Support both chatId (legacy) and threadId (new) param names.
  const threadId = searchParams.get("threadId") ?? searchParams.get("chatId");

  if (!threadId) {
    return Response.json({ error: "threadId required" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessionId = session.user.id;

  // Verify the thread exists and belongs to the caller.
  const [t] = await db
    .select()
    .from(thread)
    .where(and(eq(thread.id, threadId), eq(thread.sessionId, sessionId)))
    .limit(1);

  if (!t) {
    return new Response("Not found", { status: 404 });
  }

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.threadId, threadId))
    .orderBy(asc(message.createdAt));

  return Response.json({
    messages: convertToUIMessages(messages),
    visibility: "private",
    userId: t.sessionId,
    isReadonly: false,
  });
}
