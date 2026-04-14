# Chat-UI Starters: Live Verification (2026-04-14)

Cross-check of prior research (`chat-ui-starters.md`) against live `main` branches today.

## Raw URLs used

- `https://api.github.com/repos/vercel/chatbot/commits?per_page=1` (note: `vercel/ai-chatbot` now redirects to `vercel/chatbot`)
- `https://api.github.com/repos/vercel/ai-elements/commits?per_page=1`
- `https://api.github.com/repos/vercel/streamdown/commits?per_page=1`
- `https://api.github.com/repos/miurla/morphic/commits?per_page=1`
- `https://raw.githubusercontent.com/vercel/chatbot/main/{package.json,README.md,.env.example,lib/ai/providers.ts,lib/ai/models.ts}`
- `https://raw.githubusercontent.com/vercel/ai-elements/main/{package.json,README.md,packages/elements/package.json,packages/elements/src/{inline-citation,sources}.tsx}`
- `https://raw.githubusercontent.com/vercel/streamdown/main/packages/streamdown/{package.json,index.tsx,lib/components.tsx}`
- `https://raw.githubusercontent.com/miurla/morphic/main/components/{citation-context,citation-link}.tsx`

## vercel/ai-chatbot (now `vercel/chatbot`) — HEAD 146b3cb 2026-04-01

The repo was **renamed from `ai-chatbot` to `chatbot`** (GitHub redirects work). README now says "Chatbot (formerly AI Chatbot)". Version bumped to `3.1.0`.

### 1. Key versions (from `package.json`)
- `ai`: **6.0.116** (major bump — was AI SDK 5 in prior research)
- `@ai-sdk/react`: **3.0.118**
- `@ai-sdk/anthropic`: **not present** — removed entirely
- `next`: **16.2.0**
- `react`: **19.0.1**
- `next-auth`: `5.0.0-beta.25`
- `drizzle-orm`: `^0.34.0`; `postgres: ^3.4.4`
- `streamdown`: `^2.3.0` (plus `@streamdown/{cjk,code,math,mermaid}`)
- `@vercel/otel`, `@vercel/blob`, `@vercel/functions`, `botid` all still shipped
- `shiki: ^3.21.0`, `tailwindcss: ^4.1.13`, `@biomejs/biome` via `ultracite`

### 2. Infra inventory
- Drizzle + Neon Postgres: **yes** (`lib/db/migrate`, `drizzle.config.ts`, `POSTGRES_URL`)
- Auth.js v5 (`next-auth` beta 25): **yes**
- Vercel Blob: **yes** (`BLOB_READ_WRITE_TOKEN`)
- Streamdown + `@streamdown/*` submodules: **yes**
- Artifacts/ProseMirror: **yes** (`artifacts/` dir, 8 `prosemirror-*` deps)
- BotID: **yes** (`botid: ^1.5.11`)
- OpenTelemetry: **yes** (`@vercel/otel`, `@opentelemetry/api`, `instrumentation.ts`)
- Redis (for resumable-stream): **yes** (`redis: ^5.0.0`, `resumable-stream: ^2.2.10`, `REDIS_URL` in `.env.example`)

### 3. New since 2026-04-14 snapshot
Nothing substantive — only a README-links commit (#1476) on Apr 1. The repo has been stable for ~2 weeks. No new top-level features introduced.

### 4. What's new to strip
- **Model selector explosion**: `lib/ai/models.ts` ships 8 models across DeepSeek, Mistral (incl. Codestral), Moonshot (Kimi K2 + K2.5), GPT-OSS 20B/120B, xAI Grok 4.1 Fast. Default is `moonshotai/kimi-k2-0905`. We'll want to collapse this.
- `getAllGatewayModels()` / `getCapabilities()` now probe `ai-gateway.vercel.sh/v1/models/*/endpoints` at runtime — drop if not using gateway.
- `data-grid`, `codemirror/lang-python`, `papaparse` pulled in for data artifacts — removable if we cut artifacts.

### 5. AI Gateway vs. direct provider — BIG CHANGE
The template **no longer uses `@ai-sdk/anthropic` or any direct provider SDK**. `lib/ai/providers.ts` uses `gateway.languageModel(modelId)` from the `ai` package exclusively. Real path:

```ts
import { customProvider, gateway } from "ai";
// ...
return gateway.languageModel(modelId);
```

Test path uses a mock provider. `.env.example` only has `AI_GATEWAY_API_KEY` (no `ANTHROPIC_API_KEY`).

### 6. Claude-specific files
**None.** No `anthropic` in deps, no Claude model in `chatModels`, no provider file. For us this means: we must **add** `@ai-sdk/anthropic` ourselves (or add `claude-*` IDs to the gateway model list and keep gateway).

### 7. Cookie/session lib
Still handled entirely by `next-auth` v5. `iron-session` is **not** a dep and never was in recent history — prior research's "iron-session" claim was wrong (or stale). Auth.js v5 uses its own JWE-encrypted session cookies.

## vercel/ai-elements — HEAD 9ab9c71 2026-04-07

Monorepo (`apps/`, `packages/`). Elements live in `packages/elements/src/`.

### 1. Components — citation set confirmed
File `packages/elements/src/inline-citation.tsx` exports:
`InlineCitation`, `InlineCitationText`, `InlineCitationCard`, `InlineCitationCardTrigger`, `InlineCitationCardBody`, `InlineCitationCarousel`, `InlineCitationCarouselContent`, `InlineCitationCarouselItem` (*implied*), `InlineCitationCarouselHeader` (*implied*), `InlineCitationCarouselIndex` (*implied*), `InlineCitationCarouselPrev`, `InlineCitationCarouselNext`, `InlineCitationSource`, `InlineCitationQuote`. All present.

`sources.tsx` exports `Sources`, `SourcesTrigger`, `SourcesContent`, `Source`. All present.

Other confirmed: `conversation.tsx`, `message.tsx`, `reasoning.tsx`, `tool.tsx`, plus a `response` component (referenced in README). The `Response` export is not a separate file in today's main — there's no `response.tsx`. **Flag**: verify the `Response` component is still the correct import — it may have been folded into `message.tsx` (README sample imports `MessageResponse`).

### 2. New components since 2026-04-14 that matter for cited chat
The current src adds many: `agent.tsx`, `artifact.tsx`, `canvas.tsx`, `chain-of-thought.tsx`, `checkpoint.tsx`, `commit.tsx`, `confirmation.tsx`, `connection.tsx`, `context.tsx`, `controls.tsx`, `environment-variables.tsx`, `file-tree.tsx`, `open-in-chat.tsx`, `package-info.tsx`, `panel.tsx`, `persona.tsx`, `plan.tsx`, `queue.tsx`, `sandbox.tsx`, `schema-display.tsx`, `snippet.tsx`, `speech-input.tsx`, `stack-trace.tsx`, `task.tsx`, `terminal.tsx`, `test-results.tsx`, `toolbar.tsx`, `transcription.tsx`, `voice-selector.tsx`, `web-preview.tsx`. Only `inline-citation` + `sources` + `conversation`/`message`/`response`/`reasoning`/`tool` are needed for our path.

### 3. Install command
Confirmed: `npx ai-elements@latest add <component>`. Also `npx ai-elements@latest` (no arg) installs all. Shadcn direct path: `npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/<name>.json`.

### 4. Dependency constraints
- `packages/elements/package.json` requires `react@19.2.3`, `@radix-ui/react-use-controllable-state`, `lucide-react ^0.577.0`, `streamdown ^2.4.0`, `motion ^12.26.2`, `shiki 3.22.0`, `class-variance-authority`.
- Peer on shadcn/ui via workspace `@repo/shadcn-ui` — when installed by CLI, components import from `@/components/ui/*`. CSS Variables mode **only** (README).
- Requires Node 18+, TailwindCSS (v4 in the monorepo). No hard pin on shadcn version — uses latest shadcn registry at install time.

### 5. API stability
`InlineCitation` API is unchanged vs prior research: same props, same HoverCard under the hood. `InlineCitationCardTrigger` still takes `sources: string[]` and renders a `Badge` with hostname + count. `Sources` still `Collapsible`-based with `count` prop on trigger. **No breaking changes** for our citation render path.

## miurla/morphic — HEAD c212932 2026-04-12

- License: **Apache-2.0** (confirmed via API)
- 8,761 stars, active (last push 2026-04-13)
- `components/citation-context.tsx` and `components/citation-link.tsx` **still present and unchanged in shape** from prior research. `CitationProvider`/`useCitation` API intact; `citationMaps: Record<string, Record<number, SearchResultItem>>`. `CitationLink` uses Popover on hover with `citationData` prop. No refactor.
- Recent commits are feature-level (keyboard shortcuts dialog, `KeyboardShortcutHandler`) — not touching the citation flow.
- **Still the recommended reference pattern.**

## vercel/streamdown — HEAD 5f64751 2026-04-01

- `streamdown@2.5.0`, Apache-2.0, React 19 ready.
- Package exports `Streamdown` with a `components` prop that goes through `mergedComponents = { ...defaultComponents, ...userComponents }` (index.tsx line ~647). Means **`components.a` override still works** — user-supplied `a` overrides the default `a` cleanly.
- New surface area: `TableCopyDropdown`, `TableDownloadButton`, `StreamdownContext`, `MermaidOptions`, `ControlsConfig` (fine-grained toggles per block type), `LinkSafetyConfig` (with modal), `isAnimating`, `parseIncompleteMarkdown`, `normalizeHtmlIndentation`, per-block `dir` detection, `StreamdownTranslations`. None of these break the `components.a` path.
- `inlineCode` is special-cased (stripped before merge, re-injected conditionally). Does not affect `a`.

## What changes for our design doc / build plan

1. **Base template is `vercel/chatbot`, not `vercel/ai-chatbot`.** Update clone URL to `https://github.com/vercel/chatbot.git`. Old URL still redirects but references should be fixed.
2. **AI SDK is v6, not v5.** Any snippets assuming `ai@5` signatures must be re-verified. `@ai-sdk/react` is on the 3.0.x line.
3. **Template is Gateway-only; we must explicitly add Claude.** Options: (a) keep gateway and add `anthropic/claude-*` IDs to `chatModels`; (b) rip out the gateway path in `lib/ai/providers.ts` and replace with `import { anthropic } from "@ai-sdk/anthropic"`. Option (a) is a smaller diff.
4. **Model list must be trimmed.** Default `kimi-k2-0905` is not what we want. Replace `chatModels` with a short Claude-only list and change `DEFAULT_CHAT_MODEL`.
5. **Drop `getAllGatewayModels()` / `getCapabilities()` runtime probes** if we go non-gateway — they hit `ai-gateway.vercel.sh` and will fail silently.
6. **Redis is now required** for `resumable-stream@2` (note `REDIS_URL` in `.env.example`). Either provision Upstash or strip resumable streams.
7. **Auth.js v5 beta 25** — no `iron-session` migration needed; prior assumption was wrong.
8. **AI Elements install path unchanged** (`npx ai-elements@latest add inline-citation sources conversation message response reasoning tool`). Verify `response` is still a standalone registry entry — the src tree shows no `response.tsx`, so the registry may ship it as a re-export from `message`. Flag during install.
9. **Streamdown `components.a` override pattern still supported** — our `[[slug]]` custom-link plan is safe.
10. **Morphic citation pattern is still the reference** — no changes needed to our planned port of `CitationProvider`/`useCitation`/`CitationLink`.
11. **Tailwind v4** everywhere (chatbot and ai-elements). If our design doc assumed v3 PostCSS config, update — chatbot uses `@tailwindcss/postcss` v4.
12. **React 19** across the board. Any component code we write must be 19-compatible (no legacy refs-as-strings etc.).
