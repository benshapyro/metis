// /api/history — thread list for the sidebar.
// Proxies to the thread table (replaces old Chat-based history).

import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { thread } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") || "20", 10), 1),
    50
  );

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const rows = await db
    .select()
    .from(thread)
    .where(eq(thread.sessionId, session.user.id))
    .orderBy(desc(thread.updatedAt))
    .limit(limit);

  // Shape matches what SidebarHistory expects: { chats, hasMore }
  return Response.json({ chats: rows, hasMore: false });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  // Bulk delete not exposed in Metis v1 — delete individual threads via /api/threads/[threadId].
  return Response.json({ deletedCount: 0 });
}
