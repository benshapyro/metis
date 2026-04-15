import { createAgentUIStreamResponse } from "ai";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { message, thread } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { type MetisAgent, makeMetisAgent } from "@/lib/metis/agent";
import { persistAssistantTurn } from "@/lib/persistence/turn";
import {
  enforceRateLimit,
  type RateLimitDenied,
  type RateLimitResult,
} from "@/lib/safety/ratelimit";
import {
  enforceSpendCap,
  type SpendCheckDenied,
  type SpendCheckOk,
} from "@/lib/safety/spend-cap";

// Node runtime required: tools spawn pure-JS file walks via fs.readFile.
// maxDuration tied to stopWhen: stepCountIs(12) in agent.ts — keep them aligned;
// raising the step cap without bumping maxDuration causes mid-stream timeouts.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sessionId = session.user.id;
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0]?.trim() || "unknown";

  let rl: RateLimitResult | RateLimitDenied;
  try {
    rl = await enforceRateLimit({ sessionId, ip });
  } catch (err) {
    console.error("[chat.POST] rate limiter unavailable:", err);
    return new Response(
      "Safety checks temporarily unavailable. Please retry in a minute.",
      {
        status: 503,
        headers: { "Retry-After": "30" },
      }
    );
  }
  if (!rl.ok) {
    return new Response(rl.message, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  let spend: SpendCheckOk | SpendCheckDenied;
  try {
    spend = await enforceSpendCap();
  } catch (err) {
    console.error("[chat.POST] spend cap unavailable:", err);
    return new Response(
      "Safety checks temporarily unavailable. Please retry in a minute.",
      {
        status: 503,
        headers: { "Retry-After": "30" },
      }
    );
  }
  if (!spend.ok) {
    return new Response(spend.message, { status: 429 });
  }

  let messages: unknown[];
  let threadId: string | null;
  try {
    const body = await request.json();
    if (!Array.isArray(body?.messages)) {
      return new ChatbotError(
        "bad_request:api",
        "messages must be an array"
      ).toResponse();
    }
    messages = body.messages;
    threadId = typeof body?.threadId === "string" ? body.threadId : null;
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

  // Persist the incoming user message before starting the agent.
  if (threadId && messages.length > 0) {
    const lastUserIdx = [...messages]
      .reverse()
      .findIndex((m: any) => m.role === "user");
    const lastUserMsg =
      lastUserIdx >= 0 ? messages.at(-(lastUserIdx + 1)) : null;
    if (lastUserMsg) {
      try {
        await db.insert(message).values({
          threadId,
          sessionId,
          role: "user",
          parts: (lastUserMsg as any).parts ?? [],
          modelId: null,
        });
        // Bump thread updatedAt while we're here (Fix 12).
        await db
          .update(thread)
          .set({ updatedAt: new Date() })
          .where(eq(thread.id, threadId));
      } catch (err) {
        console.error("[chat] failed to persist user message:", err);
        // Continue — losing one user msg shouldn't block the agent.
      }
    }
  }

  // Accumulate usage across steps so onFinish can record accurate cost.
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedInputTokens = 0;
  let totalCacheCreationTokens = 0;
  let totalSteps = 0;

  try {
    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      onStepFinish: (step: any) => {
        totalSteps++;
        const u = step.usage;
        if (!u) {
          console.warn("[chat] step.usage missing; skipping accumulation");
          return;
        }
        totalInputTokens += u.inputTokens ?? 0;
        totalOutputTokens += u.outputTokens ?? 0;
        totalCachedInputTokens += u.inputTokenDetails?.cacheReadTokens ?? 0;
        totalCacheCreationTokens +=
          u.inputTokenDetails?.cacheCreationTokens ?? 0;
      },
      onFinish: ({ uiMessages: finalMessages }: any) => {
        if (!threadId) {
          console.error(
            "[chat.onFinish] no threadId in body; skipping persist"
          );
          return;
        }
        after(
          persistAssistantTurn({
            threadId,
            sessionId,
            uiMessages: finalMessages,
            totalSteps,
            usage: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              cachedInputTokens: totalCachedInputTokens,
              cacheCreationTokens: totalCacheCreationTokens,
            },
          }).catch((err) => {
            console.error("[chat.onFinish] persistAssistantTurn failed:", err);
          })
        );
      },
    });
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

  // Delete thread only if it belongs to this session.
  const [deleted] = await db
    .delete(thread)
    .where(and(eq(thread.id, id), eq(thread.sessionId, session.user.id)))
    .returning();

  if (!deleted) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  return Response.json(deleted, { status: 200 });
}
