// lib/persistence/turn.ts — persist one assistant turn + retrieval trace.
// Called from the /api/chat onFinish handler after each streaming response.

import { eq } from "drizzle-orm";
import { METIS_MODELS } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { message, retrievalTrace, thread } from "@/lib/db/schema";
import { parseBrainlinks } from "@/lib/metis/brainlink-syntax";
import { estimateCostUSD } from "@/lib/safety/cost";
import { recordSpend } from "@/lib/safety/spend-cap";

interface PersistArgs {
  threadId: string;
  sessionId: string;
  // Full conversation returned by the SDK after streaming finishes.
  uiMessages: unknown[];
  // Total agent steps from the onStepFinish accumulator.
  totalSteps?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    cacheCreationTokens?: number;
  };
}

interface ToolPart {
  type: string;
  state?: string;
  input?: unknown;
  output?: { ok?: boolean; reason?: string; data?: { slug?: string } };
}

interface TextPart {
  type: "text";
  text?: string;
}

type MessagePart = ToolPart | TextPart;

interface UiMessage {
  role: string;
  parts?: MessagePart[];
}

export async function persistAssistantTurn(args: PersistArgs): Promise<void> {
  const { threadId, sessionId, uiMessages, usage, totalSteps } = args;

  const last = (uiMessages as UiMessage[]).at(-1);
  if (!last || last.role !== "assistant") {
    return;
  }
  // Skip turns that didn't produce a real assistant response. We require at
  // least one text part with non-empty content. Two failure modes this
  // catches:
  //   1. Stream-level error before any content (e.g., AI Gateway returns
  //      `type: "error"` with "Insufficient funds" and closes immediately —
  //      parts is []).
  //   2. Mid-stream crash AFTER a tool call but BEFORE text (parts has
  //      tool-* entries but no text). Without this guard we'd persist a
  //      retrieval_trace with non-empty pagesRead + empty citedPages, which
  //      eval analytics would misread as a "clean read with no citations" —
  //      a false-quality signal.
  const hasTextContent = (last.parts ?? []).some(
    (p) => p.type === "text" && ((p as TextPart).text?.trim().length ?? 0) > 0
  );
  if (!hasTextContent) {
    return;
  }

  // Compute retrieval trace from message parts.
  const toolsCalled: Array<{
    name: string;
    args: unknown;
    ok: boolean;
    reason?: string;
  }> = [];
  const pagesRead = new Set<string>();
  const citedPages = new Set<string>();
  const hallucinated = new Set<string>();

  for (const p of last.parts ?? []) {
    if (typeof p.type === "string" && p.type.startsWith("tool-")) {
      const name = p.type.slice("tool-".length);
      const tp = p as ToolPart;
      if (tp.state === "output-available") {
        const out = tp.output;
        toolsCalled.push({
          name,
          args: tp.input,
          ok: !!out?.ok,
          reason: out?.ok ? undefined : out?.reason,
        });
        if (
          (name === "read_page" || name === "read_frontmatter") &&
          out?.ok &&
          out.data?.slug
        ) {
          pagesRead.add(out.data.slug);
        }
      } else if (tp.state === "output-error") {
        toolsCalled.push({ name, args: tp.input, ok: false, reason: "error" });
      }
    }
    if (p.type === "text") {
      for (const { slug } of parseBrainlinks((p as TextPart).text ?? "")) {
        if (pagesRead.has(slug)) {
          citedPages.add(slug);
        } else {
          hallucinated.add(slug);
        }
      }
    }
  }

  // Use the step accumulator from the caller; fall back to tool-part count.
  const stepCount = totalSteps ?? 0;
  // 12 matches the stepCountIs(12) cap in agent.ts.
  const hitStepCap = stepCount >= 12;

  // Wrap message + trace inserts in a single transaction so both succeed or
  // both roll back. Bump thread.updatedAt inside the same transaction.
  await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(message)
      .values({
        threadId,
        sessionId,
        role: "assistant",
        parts: last.parts ?? [],
        modelId: METIS_MODELS.synthesize,
      })
      .returning({ id: message.id });
    if (!m) {
      throw new Error("persistAssistantTurn: message insert returned no rows");
    }
    await tx.insert(retrievalTrace).values({
      messageId: m.id,
      sessionId,
      toolsCalled,
      pagesRead: [...pagesRead],
      citedPages: [...citedPages],
      hallucinatedCitations: [...hallucinated],
      tokenCountIn: usage?.inputTokens,
      tokenCountOut: usage?.outputTokens,
      modelCalls: usage ?? {},
      stepCount,
      hitStepCap,
    });
    // Bump thread.updatedAt (Fix 12).
    await tx
      .update(thread)
      .set({ updatedAt: new Date() })
      .where(eq(thread.id, threadId));
    return m;
  });

  // recordSpend is a separate concern — Redis failure shouldn't roll back DB.
  const cost = estimateCostUSD({
    model: METIS_MODELS.synthesize,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
    cacheCreationTokens: usage?.cacheCreationTokens ?? 0,
  });
  await recordSpend(cost);
}
