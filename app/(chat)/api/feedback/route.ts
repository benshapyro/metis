// /api/feedback — POST a rating (-1, 0, 1) for an assistant message.

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { feedback, message, thread } from "@/lib/db/schema";

export const runtime = "nodejs";

const FeedbackSchema = z.object({
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  messageId: z.string().min(1).max(64),
  note: z.string().max(2000).nullish(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessionId = session.user.id;

  const body = await req.json().catch(() => null);
  if (!body) {
    return new Response("Bad request", { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { rating, messageId, note } = parsed.data;

  // Verify the message belongs to the caller's session via a join.
  const [owned] = await db
    .select({ messageId: message.id })
    .from(message)
    .innerJoin(thread, eq(thread.id, message.threadId))
    .where(and(eq(message.id, messageId), eq(thread.sessionId, sessionId)))
    .limit(1);
  if (!owned) {
    return new Response("Not found", { status: 404 });
  }

  await db
    .insert(feedback)
    .values({ messageId, sessionId, rating, note: note ?? null })
    .onConflictDoUpdate({
      target: feedback.messageId,
      set: { rating, note: note ?? null },
    });

  return NextResponse.json({ ok: true });
}
