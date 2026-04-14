# Vercel AI SDK Assessment for my-brain Chat Surface

**Date:** 2026-04-14
**Scope:** Build a streaming, agentic, cited chat UI over ~918 local markdown pages. Next.js App Router on Vercel, Anthropic Claude, no vector DB.
**Sources:** Vercel AI SDK 6.x docs bundled with the `vercel:ai-sdk` skill (v0.40.0), plus AI Gateway model registry. Context7 and live fetches were unavailable during this run; all API shapes below come from the skill's `references/*.md` which ship from the current SDK package.

---

## 1. Core primitives

SDK 6.x surface is compact:

- **`streamText` / `generateText`** — unified generation. `maxTokens` renamed to `maxOutputTokens`; tool-loop control moved from `maxSteps` to `stopWhen: stepCountIs(n)`. `generateObject` is deprecated — use `generateText` with `output: Output.object({ schema })`.
- **`tool({ description, inputSchema, execute })`** — `parameters` renamed to `inputSchema`. Zod works as before.
- **`ToolLoopAgent`** — canonical agent bundle (model + instructions + tools). Exposes `InferAgentUIMessage<typeof agent>` for end-to-end typed tool parts on the client.
- **`@ai-sdk/anthropic` vs AI Gateway** — the skill explicitly steers you to Gateway (`import { gateway } from 'ai'`) unless you have a reason otherwise. Write `model: 'anthropic/claude-sonnet-4-5'` as a string; OIDC on Vercel is automatic; you get retries, failover, and cost tracking free. Direct Anthropic provider stays available for prompt-caching tweaks or non-Vercel dev.
- **`useChat` (`@ai-sdk/react`)** — **significantly changed** in 6.x. No longer manages input state, no `api:` prop, no `handleSubmit`. Pass `transport: new DefaultChatTransport({ api: '/api/chat' })` and call `sendMessage({ text })`.
- **Message parts** — assistant messages are an ordered array of typed parts: `text`, `tool-{toolName}`, and custom data parts. Tool parts have a `state` discriminator: `input-streaming` → `input-available` → `output-available`. TS forces you to narrow on state before reading `part.input` / `part.output` — exactly what you want for progressive rendering.
- **`toUIMessageStreamResponse()`** — the route handler's output. `toDataStreamResponse()` is deprecated for `useChat`.

## 2. Multi-step tool-use loops

The SDK's sweet spot. `ToolLoopAgent` + `stopWhen: stepCountIs(N)` round-trips the model until it stops calling tools or hits N steps. Each tool's `execute` is a plain async function — no ceremony wiring filesystem reads.

```ts
// lib/tools/brain-tools.ts
import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.BRAIN_ROOT!;

export const listPages = tool({
  description: 'List wiki pages, optionally filtered by slug substring.',
  inputSchema: z.object({ filter: z.string().optional() }),
  execute: async ({ filter }) => {
    const files = await fs.readdir(path.join(ROOT, 'wiki'), { recursive: true });
    return files.filter(f => f.endsWith('.md') && (!filter || f.includes(filter)));
  },
});

export const readPage = tool({
  description: 'Read the full markdown for one page by slug.',
  inputSchema: z.object({ slug: z.string() }),
  execute: async ({ slug }) => ({
    slug,
    text: await fs.readFile(path.join(ROOT, 'wiki', `${slug}.md`), 'utf8'),
  }),
});

export const getBacklinks = tool({
  description: 'Find pages that link to the given slug.',
  inputSchema: z.object({ slug: z.string() }),
  execute: async ({ slug }) => ({ slug, backlinks: [] as string[] }),
});
```

```ts
// lib/agents/brain-agent.ts
import { ToolLoopAgent, stepCountIs, InferAgentUIMessage } from 'ai';
import { listPages, readPage, getBacklinks } from '../tools/brain-tools';

export const brainAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4-5', // verify via AI Gateway /v1/models
  instructions: "Answer from the user's wiki. Cite with [[slug]].",
  tools: { listPages, readPage, getBacklinks },
  stopWhen: stepCountIs(12),
});

export type BrainUIMessage = InferAgentUIMessage<typeof brainAgent>;
```

```ts
// app/api/chat/route.ts
import { createAgentUIStreamResponse } from 'ai';
import { brainAgent } from '@/lib/agents/brain-agent';

export async function POST(req: Request) {
  const { messages } = await req.json();
  return createAgentUIStreamResponse({ agent: brainAgent, uiMessages: messages });
}
```

That's the entire loop. The agent iterates `listPages` → `readPage` (often several times) → text answer with no orchestration code on your side.

## 3. Surfacing intermediate tool-call steps

Every tool invocation streams through three states: `input-streaming`, `input-available`, `output-available`. Render a "Reading hmi-vendor-eval.md..." line by keying off the `tool-readPage` part in `input-available`:

```tsx
export function Message({ message }: { message: BrainUIMessage }) {
  return message.parts.map((part, i) => {
    switch (part.type) {
      case 'text': return <Markdown key={i}>{part.text}</Markdown>;
      case 'tool-readPage':
        if (part.state === 'input-available') return <Step key={i}>Reading {part.input.slug}.md...</Step>;
        if (part.state === 'output-available') return <Step key={i} done>Read {part.input.slug}.md</Step>;
        break;
      case 'tool-listPages':
        if (part.state === 'input-available') return <Step key={i}>Scanning index...</Step>;
        break;
    }
  });
}
```

The SDK streams part transitions incrementally — no custom stream parser required.

## 4. Citation rendering

No first-class citation primitive. Two real-world patterns:

1. **Inline markers.** Instruct the model to emit `[[slug]]` and post-process the text part with a remark plugin that rewrites them to `<a href="/wiki/slug">`. This is what `vercel/ai-chatbot` does for URL citations and what `assistant-ui` does for SourceRef affordances. Cheap, works with any model; render idempotently to tolerate partial markers mid-stream.
2. **Custom data parts.** `readPage` can emit `{ type: 'data-citation', slug, title, preview }` via `streamText`'s data-part API, which the client renders as a sources rail. More structured, ties you to SDK internals.

For v1: pattern 1 plus a "Sources" footer derived from all `tool-readPage` parts with `output-available` — this gives a reliable citation list even when the model forgets to mark inline.

Anthropic's native citations API is not surfaced through 6.x message parts; using it means dropping to the raw provider and losing typed UI messages. Skip for v1.

## 5. Filesystem vs vector DB

The SDK is **agnostic** — nothing in `streamText`, `ToolLoopAgent`, or `useChat` assumes a vector store. Retrieval is whatever your tools' `execute` functions do. `fs.readFile` is fully supported.

Deployment caveats for Vercel:

- Serverless functions don't have `/Users/bshap/...`. Ship the wiki with the app: (a) git submodule into the Next.js repo (simplest); (b) push to Vercel Blob or Turso on deploy; (c) host on Fly/Railway with a persistent volume.
- For 918 files, (a) is fine. Set `export const runtime = 'nodejs'` on the route (Edge can't do `fs`) and include the wiki via `outputFileTracingIncludes` in `next.config.js`.

## 6. Effort estimate

For one dev who knows Next.js App Router: **3–5 days to a demoable v1.**

- Day 1: scaffold Next.js app, wire AI Gateway key, stub tools with hardcoded responses, get `streamText` answering with no retrieval.
- Day 2: real `listPages` / `readPage` / `getBacklinks` over the bundled wiki dir. Tune `stopWhen` and instructions.
- Day 3: `useChat` + message-part rendering, tool-step pills ("Reading X..."), markdown render with remark plugin for `[[slug]]` links.
- Day 4: auth guard (middleware with shared-password check against `APP_PASSWORD` env), Vercel deploy, `outputFileTracingIncludes`.
- Day 5: conversation persistence (SQLite on Turso or Vercel Postgres; store `UIMessage[]` JSON blobs per thread), polish.

Multi-thread UI is another 1–2 days when you want it; the data model is trivial once you've stored per-thread message arrays.

## 7. Known gotchas

- **`useChat` API churn.** Anything older than 6.x online is wrong. `input`, `handleInputChange`, `handleSubmit`, `api:` are all gone. Use `transport: new DefaultChatTransport({ api })`, `sendMessage({ text })`, and `useState` for the input.
- **Tool part renames.** `args`→`input`, `result`→`output`, `toolInvocation.toolCallId`→`toolCallId`, states `partial-call`/`call`/`result`→`input-streaming`/`input-available`/`output-available`. `addToolResult`→`addToolOutput`. Generic `tool-invocation` type replaced by typed `tool-{toolName}` parts.
- **`createAgentUIStreamResponse` param name** is `uiMessages`, not `messages`.
- **Model IDs.** Never trust memory. Run `curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("anthropic/")) | .id] | reverse | .[]'` and pick the highest version.
- **Tool-loop depth.** Token budget dies around 15–20 steps on big pages. Set `stopWhen: stepCountIs(12)` and watch usage in `@ai-sdk/devtools`.
- **Edge runtime + `fs` don't mix.** Node runtime only for the chat route.
- **Streaming markers mid-token.** Partial `[[slug` fragments appear; your remark plugin must tolerate incomplete wikilinks.
- **Anthropic citations feature** doesn't round-trip through UI message parts. Skip it.

## 8. Starter templates

1. **`vercel/ai-chatbot`** — official reference. Next.js App Router, `useChat`, message parts, streaming, NextAuth, Vercel Postgres persistence. Pros: canonical, kept current, correct server plumbing. Cons: ships with stuff you don't need (model selector, generative UI demo) — rip them out.
2. **`assistant-ui/assistant-ui`** — richer chat UI components that plug into the AI SDK. Pros: polished message rendering, tool-call UI, citation affordance, markdown out of the box. Cons: opinionated primitives.
3. **`vercel-labs/ai-sdk-agent-template`** (verify name on github.com/vercel-labs before cloning) — minimal `ToolLoopAgent` + `useChat` wiring. Pros: closest to our shape. Cons: sparse UI.

**Recommendation:** start from `vercel/ai-chatbot`, strip the model selector and generative UI demo, swap in our three tools and a shared-password middleware. Ships faster than `assistant-ui` because the server plumbing already matches the SDK version.

---

## Verdict

**Use it.**

AI SDK 6.x is the right tool and the least-resistance path:

- Multi-step loops are a one-liner (`stopWhen: stepCountIs(N)`).
- Typed message parts give you the "Reading X.md..." progressive UI with end-to-end TS safety via `InferAgentUIMessage`.
- No vector DB required — `fs.readFile` is a first-class retrieval strategy for 918 pages.
- AI Gateway removes Anthropic key friction and opens swap/fallback to other providers later.
- Vercel deploy is the designed path; streaming, auth middleware, Node runtime all just work.

Caveats, not blockers: citation rendering is a DIY remark plugin (half-day); ship the wiki via submodule + `outputFileTracingIncludes` (or Blob/Turso) — decide before day 4; budget half a day to unlearn pre-6.x `useChat` (most blog posts are stale).

Only consider an alternative (raw Anthropic SDK + custom SSE, Mastra, LangChain JS) if you need native Anthropic citations round-tripped to the UI or you're already committed to another agent framework. For this shape of problem, the Vercel AI SDK is the default answer.
