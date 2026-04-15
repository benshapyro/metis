import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { thread } from "@/lib/db/schema";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const sessionId = session.user.id;

  const [latest] = await db
    .select()
    .from(thread)
    .where(eq(thread.sessionId, sessionId))
    .orderBy(desc(thread.updatedAt))
    .limit(1);

  if (latest) {
    redirect(`/chat/${latest.id}`);
  }

  // No threads yet — create one and redirect.
  const [created] = await db.insert(thread).values({ sessionId }).returning();

  redirect(`/chat/${created.id}`);
}
