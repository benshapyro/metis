// lib/persistence/turn.ts — persist one assistant turn + retrieval trace.
// Called from the /api/chat onFinish handler after each streaming response.

import { METIS_MODELS } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { message, retrievalTrace } from "@/lib/db/schema";
import { estimateCostUSD } from "@/lib/safety/cost";
import { recordSpend } from "@/lib/safety/spend-cap";

interface PersistArgs {
  threadId: string;
  sessionId: string;
  // Full conversation returned by the SDK after streaming finishes.
  uiMessages: unknown[];
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
  const { threadId, sessionId, uiMessages, usage } = args;

  const last = (uiMessages as UiMessage[]).at(-1);
  if (!last || last.role !== "assistant") {
    return;
  }

  const [inserted] = await db
    .insert(message)
    .values({
      threadId,
      sessionId,
      role: "assistant",
      parts: last.parts ?? [],
      modelId: METIS_MODELS.synthesize,
    })
    .returning({ id: message.id });

  const messageId = inserted.id;

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
  let stepCount = 0;
  let hitStepCap = false;

  for (const p of last.parts ?? []) {
    if (typeof p.type === "string" && p.type.startsWith("tool-")) {
      stepCount++;
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
      const text = (p as TextPart).text ?? "";
      for (const m of text.matchAll(/\[\[([^\]\n|]+?)(?:\|[^\]\n]*)?\]\]/g)) {
        const slug = m[1].trim();
        if (pagesRead.has(slug)) {
          citedPages.add(slug);
        } else {
          hallucinated.add(slug);
        }
      }
    }
  }

  // 12 matches the stepCountIs(12) cap in agent.ts.
  if (stepCount >= 12) {
    hitStepCap = true;
  }

  await db.insert(retrievalTrace).values({
    messageId,
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

  const cost = estimateCostUSD({
    model: METIS_MODELS.synthesize,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
    cacheCreationTokens: usage?.cacheCreationTokens ?? 0,
  });
  await recordSpend(cost);
}
