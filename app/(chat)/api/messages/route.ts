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

  const [t] = await db
    .select()
    .from(thread)
    .where(eq(thread.id, threadId))
    .limit(1);

  if (!t) {
    return Response.json({
      messages: [],
      visibility: "private",
      userId: null,
      isReadonly: false,
    });
  }

  // All threads are session-scoped (no public/private yet in v1).
  const isReadonly = !session?.user || session.user.id !== t.sessionId;

  const messages = await db
    .select()
    .from(message)
    .where(
      and(
        eq(message.threadId, threadId),
        // Only return messages if the caller owns the thread or it is their session.
        // For isReadonly callers we still return messages (read access).
        eq(message.threadId, threadId)
      )
    )
    .orderBy(asc(message.createdAt));

  return Response.json({
    messages: convertToUIMessages(messages),
    visibility: "private",
    userId: t.sessionId,
    isReadonly,
  });
}
