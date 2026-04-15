// /api/threads — list and create threads.
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { thread } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessionId = session.user.id;
  const rows = await db
    .select()
    .from(thread)
    .where(eq(thread.sessionId, sessionId))
    .orderBy(desc(thread.updatedAt))
    .limit(50);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sessionId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const [row] = await db
    .insert(thread)
    .values({ sessionId, title: body?.title ?? null })
    .returning();
  return NextResponse.json(row);
}
