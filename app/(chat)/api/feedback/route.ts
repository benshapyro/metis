// /api/feedback — POST a rating (-1, 0, 1) for an assistant message.
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";

export const runtime = "nodejs";

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

  const rating = Number(body.rating);
  if (![-1, 0, 1].includes(rating)) {
    return new Response("Bad rating — must be -1, 0, or 1", { status: 400 });
  }

  const messageId = String(body.messageId ?? "");
  if (!messageId) {
    return new Response("Missing messageId", { status: 400 });
  }

  await db
    .insert(feedback)
    .values({ messageId, sessionId, rating, note: body.note ?? null })
    .onConflictDoUpdate({
      target: feedback.messageId,
      set: { rating, note: body.note ?? null },
    });

  return NextResponse.json({ ok: true });
}
