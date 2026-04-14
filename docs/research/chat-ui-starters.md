# Chat UI Starter Templates for my-brain-surface

**Date:** 2026-04-14
**Context:** Next.js App Router chat over 918 local markdown pages, agentic retrieval (no vectors), Claude as primary model. Must-haves: streaming, inline clickable citations, source-preview side panel, conversation thread. Target: leadership-demo quality in ~2–3 weeks of single-dev effort.

## TL;DR — Recommended Path

**Fork `vercel/ai-chatbot`, layer in `ai-elements` (especially `Sources` + `InlineCitation`), steal Morphic's citation-link/popover pattern, render with `streamdown`.** Skip Assistant Cloud and kibo-ui for v1. Cut ai-chatbot's artifacts/CodeMirror/Prosemirror surface area (most of the ~100MB of deps) — you do not need the document editor.

---

## 1. Vercel `ai-chatbot` (primary fork candidate)

- **URL:** https://github.com/vercel/ai-chatbot
- **Stars:** 20,104 | **Last push:** 2026-04-14 (active today) | **License:** Apache-2.0
- **Stack (verified from `package.json` on main):** Next.js 16.2, React 19, AI SDK **v6** (`ai@6.0.116`, `@ai-sdk/react@3.0.118`), Drizzle ORM + Neon Serverless Postgres, Auth.js 5 (beta), Vercel Blob, Tailwind v4, shadcn/ui, **Streamdown 2.3** (already integrated), Playwright tests, Biome + Ultracite.
- **Model routing:** Uses Vercel AI Gateway by default; README says OpenAI, Anthropic, Google, xAI, and others via Gateway. Bundled models list = Mistral, Moonshot, DeepSeek, OpenAI, xAI (Claude not preconfigured but one-liner to add via `@ai-sdk/anthropic`).
- **What ships:** chat persistence, resumable streams (`resumable-stream`), tool calls, multimodal attachments, auth flows, artifacts (ProseMirror + CodeMirror editors), chat sharing, bot protection (`botid`), OpenTelemetry, feature-rich sidebar, light/dark, KaTeX math, Mermaid.
- **What it does NOT ship:** inline citations / source panels. There is no first-class RAG UI. You build that layer yourself (see section 4).
- **Keep:** chat route, `useChat` wiring, Drizzle schema for threads/messages, Auth.js setup, Streamdown rendering, sidebar.
- **Strip for v1:** artifacts system (`app/(chat)/artifact`, ProseMirror/CodeMirror deps), Vercel Blob uploads (unless you want PDF ingest), bot protection, AI Gateway indirection (call Anthropic direct — simpler demos).

This is the highest-leverage starting point because it solves auth + persistence + streaming + markdown render + thread history out of the box, all with Vercel's current idioms.

## 2. assistant-ui (component library, not a template)

- **URL:** https://github.com/assistant-ui/assistant-ui
- **Stars:** 9,318 | **Last push:** 2026-04-14 (daily activity) | **License:** MIT | YC-backed.
- **What it is:** Radix-style headless primitives for chat UX — `Thread`, `Composer`, `Message`, `MessagePrimitive.Content`, `ThreadPrimitive.Messages`. Not an app, not a DB, not auth. Think cmdk/shadcn for chat.
- **AI SDK integration:** First-class adapter for Vercel AI SDK (and LangGraph, Mastra, custom backends). Supports Anthropic directly. `npx assistant-ui create` scaffolds a starter; `init` adds to an existing project.
- **Citations:** Not native. README screenshot explicitly shows a "Perplexity clone created with assistant-ui" — citations are a user-built composition on top of the primitives, not a bundled component. You'd still wire `InlineCitation` yourself.
- **Verdict:** Excellent library, but if you pick `ai-chatbot` you already have a concrete Thread/Composer built the Vercel way. Adopting assistant-ui would mean rebuilding the shell. **Use only if you reject ai-chatbot.** If you do go this route, pair it with `@assistant-ui/react-ai-sdk` and the shadcn-theme starter, and still use `streamdown` inside `MessagePrimitive.Content`.

## 3. shadcn-style chat registries (AI Elements, kibo-ui)

- **Vercel AI Elements** — https://github.com/vercel/ai-elements — **1,918 stars**, last push 2026-04-07, **Apache-2.0**. A shadcn-compatible registry (`npx ai-elements@latest add <component>`) specifically for AI. Installed into your repo as source (shadcn model — you own the code). Components that matter for this project:
  - `conversation`, `message`, `response` (wraps Streamdown)
  - **`sources`** (`Sources`, `SourcesTrigger`, `SourcesContent`) — collapsible source list per message
  - **`inline-citation`** (`InlineCitation`, `InlineCitationText`, `InlineCitationCard`, `InlineCitationCardTrigger`, `InlineCitationCardBody`, `InlineCitationCarousel*`) — hover-pill citation with carousel of source cards. This is exactly the Perplexity-style pattern requested.
  - `reasoning`, `chain-of-thought`, `tool`, `artifact`, `code-block`, `web-preview`, `task`
- **Verdict:** **This is the citation primitive you should adopt.** ai-chatbot does not install these by default, but they're drop-in compatible with its shadcn setup.
- **kibo-ui** — https://github.com/haydenbleasel/kibo — 3,709 stars, last push 2026-03-17, MIT. Broad shadcn registry (kanban, calendar, code block, marquee, etc.). The AI-specific content points back to Vercel AI Elements as "Recommended". Skip for v1; nothing chat-specific beyond what AI Elements already has.
- **shadcn/ui core** — no official chat components. The ecosystem has consolidated on AI Elements.

## 4. Perplexity-style citation references

- **Morphic** — https://github.com/miurla/morphic — **8,761 stars**, last push 2026-04-13, **Apache-2.0**. Generative-UI search engine built on AI SDK v6 (`ai@^6.0.156`, `@ai-sdk/anthropic`, `@ai-sdk/react@^3.0.158`), Next.js 16, Supabase auth, Drizzle + Postgres, Redis. Relevant files to study / borrow:
  - `components/citation-link.tsx` — numbered pill rendered as `<a>` with Radix `Popover` showing favicon + hostname + snippet. Detects "citation vs normal link" by regex on child text.
  - `components/citation-context.tsx` — React context (`CitationProvider`, `useCitation`) mapping citation IDs → `SearchResultItem`, keyed by message.
  - `components/source-favicons.tsx`, `search-results.tsx`, `answer-section.tsx` — the full stack of source list + inline ref + answer pane.
  This is the cleanest open-source reference for inline citations with hover preview. MIT-compatible (Apache-2.0) so you can lift files directly with attribution.
- **Perplexica** — https://github.com/ItzCrazyKns/Perplexica — 33,733 stars, MIT, last push 2026-04-11. Bigger scope (self-hosted Perplexity clone with SearxNG). Good UX reference but heavier to borrow from; uses its own stack.

## Streaming Markdown + Citations in React

- **Streamdown** — https://github.com/vercel/streamdown — 4,995 stars, Apache-2.0, last push 2026-04-02. **This is the answer.** Drop-in for `react-markdown`, built by Vercel specifically for AI streaming: handles unterminated code fences/tables mid-token (via `remend`), memoized, Shiki highlighting, KaTeX math, Mermaid, GFM, hardened with `rehype-harden`. Already integrated into ai-chatbot and AI Elements' `<Response>`.
- **Citation rendering pattern that works:**
  1. Ask Claude to emit citations as markdown links, e.g. `[1](brain://page-slug)` or `[1](#cite-1)`.
  2. Pass Streamdown a custom `components.a` override (same API as react-markdown).
  3. If `href` matches your citation scheme, render `<InlineCitation>` (from AI Elements) or Morphic's `CitationLink` with a Popover; otherwise normal link.
  4. Click handler calls `setSelectedSource(id)` in a context; a right-side `<Sheet>` or resizable panel reads it and renders the markdown page via the same `<Streamdown>` component.
- **Avoid:** `react-markdown` alone (breaks on partial tokens), `marked` + manual rehydrate (reinventing what Streamdown solved).

## Recommended Path (concrete)

1. `pnpm create next-app` from `vercel/ai-chatbot` (Apache-2.0 — attribution only).
2. Swap AI Gateway for direct `@ai-sdk/anthropic` with Claude as default.
3. `npx ai-elements@latest add conversation message response sources inline-citation reasoning` — adds citation primitives to your repo as owned source.
4. Copy `citation-context.tsx` + `citation-link.tsx` patterns from Morphic (Apache-2.0); adapt `SearchResultItem` to your markdown-page metadata shape (slug, title, excerpt, filepath).
5. Build a right-side source-preview panel with shadcn `Sheet` or `ResizablePanelGroup`, rendering the cited markdown page through `<Streamdown>`.
6. Delete: `app/(chat)/artifact/*`, ProseMirror/CodeMirror deps, Vercel Blob, botid, OTel. Keep Drizzle+Neon (or switch to SQLite for a local demo).
7. **Defer for v1:** multi-user auth (use Auth.js guest mode or single hardcoded user), file uploads, chat sharing, multi-model selector, artifacts.

**Effort estimate:** the starter already covers ~60% of the work. The citation layer (steps 3–5) is ~4–6 dev-days. 2–3 weeks is realistic for demo quality including the retrieval backend.

## Sources

- https://github.com/vercel/ai-chatbot (README, package.json, LICENSE — all fetched 2026-04-14)
- https://github.com/assistant-ui/assistant-ui (README fetched 2026-04-14)
- https://github.com/vercel/ai-elements (README fetched 2026-04-14)
- https://github.com/vercel/streamdown (packages/streamdown/README.md fetched 2026-04-14)
- https://github.com/miurla/morphic (README, package.json, components/citation-*.tsx fetched 2026-04-14)
- https://github.com/haydenbleasel/kibo (README fetched 2026-04-14)
- https://ai-sdk.dev/elements/components/inline-citation
- https://ai-sdk.dev/elements/components/sources
