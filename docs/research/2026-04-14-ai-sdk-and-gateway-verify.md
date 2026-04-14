# AI SDK v6 & AI Gateway — Live-Docs Verification

**Date:** 2026-04-14
**Purpose:** Cross-check `docs/research/vercel-ai-sdk-assessment.md` (prior assessment, written from bundled skill refs in a sandboxed subagent) against live docs and the live Gateway `/v1/models` endpoint.
**Method:** WebFetch of `ai-sdk.dev/docs/*`, `vercel.com/docs/ai-gateway/*`, and a sandbox-enabled `curl` of `https://ai-gateway.vercel.sh/v1/models` (success, 155,187 bytes JSON).
**Constraints encountered:** Context7 MCP (`resolve-library-id` / `query-docs`) was denied for this session. GitHub releases API blocked by TLS trust-store issue in the sandbox (`x509: OSStatus -26276`), so changelog cross-check was done via the AI SDK v6 migration guide (`/docs/migration-guides/migration-guide-6-0`) rather than the raw CHANGELOG.

---

## Per-item findings

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | `ToolLoopAgent` canonical agent; `{model, instructions, tools, stopWhen}` | ⚠ Partially changed | `ai-sdk.dev/docs/agents/building-agents` confirms `import { ToolLoopAgent } from 'ai'` and the constructor accepts `model`, `instructions`, `tools`, `toolChoice`, `stopWhen`, `output`, `onStepFinish`. Migration guide notes **`ToolLoopAgent` replaces `Experimental_Agent`**, and the old `system` param was **renamed to `instructions`**. Prior report's shape is correct. Added params to know about: `toolChoice`, `output`, `onStepFinish`. |
| 2 | `stopWhen: stepCountIs(N)` caps tool-loop steps | ✅ Still correct | `ai-sdk.dev/docs/agents/loop-control` — primitives are `stepCountIs(count)`, `hasToolCall(toolName)`, `isLoopFinished()`. **Default** on `ToolLoopAgent` is now `stepCountIs(20)` (up from 1 in v5). Combine with arrays; custom `StopCondition` supported. |
| 3 | `createAgentUIStreamResponse({agent, uiMessages})` | ✅ Still correct | `ai-sdk.dev/docs/agents/building-agents`. Param name is **`uiMessages`** (not `messages`). Signature unchanged. |
| 4 | `tool({description, inputSchema, execute})` | ✅ Still correct | `ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`. Fields: `description`, `inputSchema` (Zod or JSON Schema), `execute`, plus optional `strict` and `needsApproval`. `parameters` is not used. `ToolCallOptions` was renamed to **`ToolExecutionOptions`** in v6. |
| 5 | `useChat` — `DefaultChatTransport({api})`, `sendMessage({text})`, no `input`/`handleSubmit` | ✅ Still correct | `ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat`. `sendMessage` accepts `{ text, files?, metadata?, messageId? }` or a `CreateUIMessage`. `input`, `handleInputChange`, `handleSubmit`, and the `api:` prop are gone. `status: 'submitted' \| 'streaming' \| 'ready' \| 'error'` is what you gate sends on. |
| 6 | Typed `tool-{toolName}` parts with state discriminators | ⚠ Partially changed (expanded, not broken) | `ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`. Confirmed states: `input-streaming`, `input-available`, `output-available`, **`output-error`** (new/now documented separately), and **`approval-requested`** (new for human-in-the-loop). Tool streaming is on by default. No renames. Also renamed helper utilities: `isToolUIPart` → `isStaticToolUIPart`, `isToolOrDynamicToolUIPart` → `isToolUIPart`, `getToolName` → `getStaticToolName`, `getToolOrDynamicToolName` → `getToolName`. |
| 7 | `InferAgentUIMessage<typeof agent>` exported | ✅ Still correct | `import { InferAgentUIMessage } from 'ai'`. Exported alongside `createAgentUIStreamResponse`. |
| 8 | Gateway import pattern & OIDC auto-auth | ❌ Wrong import path | Prior report shows `import { gateway } from 'ai'`. Current canonical pattern (`vercel.com/docs/ai-gateway/models-and-providers`) is either **(a)** pass a plain string `model: 'anthropic/claude-opus-4.6'` (Gateway is the default provider for string model IDs), or **(b)** `import { gateway } from '@ai-sdk/gateway'` and wrap: `model: gateway('anthropic/claude-opus-4.6')`. Vercel OIDC auto-auth is still supported (`vercel.com/docs/ai-gateway/authentication-and-byok/authentication`); tokens last 12h, refresh via `vercel env pull`. Falls back to `AI_GATEWAY_API_KEY` env var. |
| 9 | Live Anthropic model IDs via Gateway | ❌ Prior report references non-existent IDs | Live `curl https://ai-gateway.vercel.sh/v1/models` (155KB JSON) returned these exact Anthropic IDs, sorted by `released` desc: <br>• `anthropic/claude-sonnet-4.6` (1M ctx, released 2026-02-17) **← newest Sonnet**<br>• `anthropic/claude-opus-4.6` (1M ctx, released 2026-02-04) **← newest Opus**<br>• `anthropic/claude-haiku-4.5` (200K ctx, released 2025-10-15)<br>• `anthropic/claude-sonnet-4.5` (1M ctx, released 2025-09-29)<br>• `anthropic/claude-opus-4.5` (200K ctx, released 2024-11-24)<br>• `anthropic/claude-opus-4.1` (200K ctx, released 2025-05-22)<br>• `anthropic/claude-opus-4` (200K ctx, released 2025-08-05)<br>• `anthropic/claude-sonnet-4` (1M ctx, released 2025-05-22)<br>• `anthropic/claude-3.7-sonnet`, `anthropic/claude-3.5-haiku`, `anthropic/claude-3-haiku` (legacy).<br>Prior report used `anthropic/claude-sonnet-4-5` (**dashes**) — the live format uses **dots**: `anthropic/claude-sonnet-4.6`. It also referenced `claude-opus-4-6` which doesn't exist. Correct ID is `claude-opus-4.6`. |
| 10 | Anthropic prompt caching via Gateway | ⚠ Partially changed — Gateway now has a convenience mode | Two paths: <br>**(a) Gateway auto-cache (new):** `providerOptions.gateway.caching: 'auto'` in your `streamText`/`generateText` call. Gateway inserts `cache_control` breakpoints at the end of static content for Anthropic (direct/Vertex/Bedrock) and MiniMax. Source: `vercel.com/docs/ai-gateway/models-and-providers/automatic-caching`. <br>**(b) Manual (fine-grained):** set `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }` on a specific message part (or `{ type: 'ephemeral', ttl: '1h' }` for the 1-hour extended tier). Default TTL is 5 min. Minimum cacheable prompt is **1,024–4,096 tokens** depending on Claude version — a 50K-token preload clears this comfortably. Reporting: `result.providerMetadata?.anthropic?.cacheCreationInputTokens` is documented; live docs do **not** currently show a `cacheReadInputTokens` field in the AI SDK provider doc (Anthropic's native API reports `cache_read_input_tokens` in `usage`, and it may surface through `providerMetadata` — treat as unverified via AI SDK docs). **Gateway caveat:** `caching: 'auto'` places the breakpoint automatically; for a 50K static preload you probably want manual `cacheControl` so the breakpoint sits exactly where you want it. |
| 11 | Breaking changes since v6.0.116 | ⚠ Many — see below | Collected from `ai-sdk.dev/docs/migration-guides/migration-guide-6-0`: <br>• `Experimental_Agent` → **`ToolLoopAgent`**<br>• `system` param → **`instructions`**<br>• Default `stopWhen` now **`stepCountIs(20)`** (was `stepCountIs(1)`)<br>• `CoreMessage` removed → **`ModelMessage`**; `convertToModelMessages()` is now **async** (requires `await`)<br>• `generateObject` / `streamObject` **deprecated** → use `generateText`/`streamText` with `Output.object()`<br>• Tool helper renames: `isToolUIPart` → `isStaticToolUIPart`, etc. (see row 6)<br>• `ToolCallOptions` → **`ToolExecutionOptions`**<br>• `textEmbeddingModel` → **`embeddingModel`**; `textEmbedding` → **`embedding`**<br>• Warning types unified into single `Warning` export<br>• `unknown` finish reason now returns as **`other`**<br>• `toModelOutput()` receives `{ output }` object (not bare `output`)<br>• Per-tool `strict` replaces global `strictJsonSchema` in `providerOptions`<br>• OpenAI: `strictJsonSchema` defaults to `true`<br>• Anthropic: new `structuredOutputMode` option<br>• Mocks updated V2 → V3 (`MockLanguageModelV2` → V3)<br>The GitHub releases API was blocked by a TLS issue in this sandbox, so any patch-level notes after 6.0 are **unverified** for this report. |

---

## What changes in our design doc

Concrete edits needed to `docs/research/vercel-ai-sdk-assessment.md` (and any prompt/code skeletons we've drafted from it):

1. **Model IDs — change dashes to dots.**
   - Before: `model: 'anthropic/claude-sonnet-4-5'`
   - After: `model: 'anthropic/claude-sonnet-4.6'` (or `anthropic/claude-opus-4.6` if we want the newest Opus with 1M context)
   - For our brain-surface use case with a ~50K static preload and multi-step tool loops, **`anthropic/claude-sonnet-4.6`** (1M context, released 2026-02-17, newest) is the right default. Fall back / compare against `anthropic/claude-opus-4.6` for harder synthesis steps.

2. **Gateway import — fix the import path.**
   - Before: `import { gateway } from 'ai'`
   - After: either **(a)** omit the import entirely and just use the model string (Gateway is the default when you pass `'anthropic/…'`), or **(b)** `import { gateway } from '@ai-sdk/gateway'` and call `gateway('anthropic/claude-sonnet-4.6')`. Install `@ai-sdk/gateway` explicitly if using form (b).

3. **Prompt caching — prefer manual `cacheControl` for the 50K preload, not `caching: 'auto'`.**
   For a known-static 50K-token preload (wiki index, instructions, examples), manual placement gives us deterministic breakpoint positioning and keeps the rest of the message graph unaffected. Add `providerOptions.anthropic.cacheControl: { type: 'ephemeral', ttl: '1h' }` to the system/preload part. Read `result.providerMetadata?.anthropic?.cacheCreationInputTokens` for write telemetry. Track cache-read counts via Gateway's per-request logs for now (AI SDK docs don't explicitly expose a `cacheReadInputTokens` field; Anthropic's underlying API does return `cache_read_input_tokens` and it may pass through — verify in live traces before claiming).

4. **Tool-part UI — add `output-error` and `approval-requested` branches.**
   Our example `switch (part.state)` block only handles `input-available` and `output-available`. Add `output-error` (render a red error line with `part.errorText`) and — if we ever add any tool gated by human approval — `approval-requested`.

5. **Gateway model-ID lookup command — update.**
   The jq snippet in prior report's "Known gotchas" is still correct (`curl -s https://ai-gateway.vercel.sh/v1/models | jq …`). The `/v1/models` endpoint requires no auth, returns the canonical ID list (confirmed 2026-04-14, 155KB response).

6. **Default `stopWhen` — our explicit `stepCountIs(12)` is still sensible**, but noting that the SDK default is now `stepCountIs(20)`, not `stepCountIs(1)`. If we drop our explicit cap, behavior is still safe.

7. **`convertToModelMessages` is async in v6** — if the design doc references converting inbound UIMessages to ModelMessages anywhere, it needs `await`. Quick grep for `convertToModelMessages` in the skeleton before shipping.

8. **`generateObject` / `structured output`** — if we plan structured-output anywhere (e.g., a "titles" subroutine that returns `{ title, summary }`), use `generateText` with `output: Output.object({ schema })`, not `generateObject`.

No other shape changes are required. The core design (ToolLoopAgent + stepCountIs + createAgentUIStreamResponse + useChat with DefaultChatTransport + typed tool parts + InferAgentUIMessage) all matches the current live docs.

---

## Unverified / flagged

- **Context7** was denied this session — if you re-run with Context7 permitted, cross-check items #1–#7 against `/vercel/ai` there.
- **GitHub releases** blocked by TLS trust error in sandbox — patch-level v6.x release notes (6.0.116 → current HEAD) were not individually inspected. The migration guide covers the v5→v6 cliff; minor 6.x deprecations could exist. Safe to assume not, but worth a follow-up `gh api repos/vercel/ai/releases` from a host with working certs.
- **`cacheReadInputTokens` field** in `providerMetadata.anthropic` — not documented in the AI SDK Anthropic provider page as of 2026-04-14. Anthropic's raw API returns it; may be surfaced by the provider. Verify in a live trace before relying on it for metrics.
