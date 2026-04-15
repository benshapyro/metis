// /api/threads/[threadId] — get thread detail or delete a thread.
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { message, thread } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessionId = session.user.id;
  const { threadId } = await params;

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

  return NextResponse.json({ thread: t, messages });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessionId = session.user.id;
  const { threadId } = await params;

  const [deleted] = await db
    .delete(thread)
    .where(and(eq(thread.id, threadId), eq(thread.sessionId, sessionId)))
    .returning({ id: thread.id });

  if (!deleted) {
    return new Response("Not found", { status: 404 });
  }
  return NextResponse.json({ ok: true, id: deleted.id });
}
