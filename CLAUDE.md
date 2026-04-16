# Metis — Cadre Knowledge Chat Surface

v1 chat interface over `wiki/` submodule using Vercel AI SDK v6 + Auth.js v5 + Drizzle/Neon + Upstash.
Design canon: `docs/plans/2026-04-14-brain-surface-design.md` + 22 decisions in `docs/plans/2026-04-14-brain-surface-decisions.md`.
Last session handover: `docs/handovers/` (newest file).
**Ignore `README.md`** — template-generic from `vercel/chatbot`, stale (still mentions Moonshot/DeepSeek/Blob which were stripped in Phase 1). `CLAUDE.md` + `docs/plans/` are authoritative.
**Code style:** `.cursor/rules/ultracite.mdc` covers biome + accessibility + type-safety rules. Follow biome output; don't re-state those rules here.

## Quick start

- `pnpm install && pnpm dev` — local dev at `localhost:3000`
- `pnpm test` — 57 Vitest tests (tools + wiki + remark + hot-caches + cost + prompt + citation-allowlist + error-classifier)
- `pnpm exec tsc --noEmit && node_modules/.bin/biome check .` — pre-commit sanity
- Restart dev after env change: `pkill -f "next dev" && pnpm dev`
- Check preview build logs: `vercel inspect <deploy-id> --logs | tail -80`

## Directory map

- `app/(auth)/` — login page + auth.ts (Auth.js v5 Credentials)
- `app/(chat)/` — layout + shell + per-thread page; `api/chat|threads|feedback|messages|pages/[slug]`
- `app/api/warm/` — cron-hit hot-cache refresh
- `lib/metis/` — `agent.ts`, `prompt.ts`, `hot-caches.ts`, `wiki.ts`, `tools/*`, `brainlink-syntax.ts`
- `lib/safety/` — `ratelimit.ts`, `spend-cap.ts`, `cost.ts`
- `lib/persistence/turn.ts` — `persistAssistantTurn` (message + retrieval_trace + spend record)
- `lib/db/` — Drizzle schema + client
- `components/metis/` — Metis UI (message, composer, feedback, source-panel, inline-citation, welcome, citation-context, remark-brainlink, tool-step-pill)
- `components/ai-elements/` — installed from `vercel/ai-elements` registry (owned source)
- `wiki/` — `my-brain` git submodule; content lives under `wiki/wiki/`
- `docs/plans/` — design + decisions + eval + prompt skeleton (locked)
- `docs/handovers/` — session summaries (newest first)
- `tests/unit/` — Vitest specs; `tests/fixtures/wiki/` is the test wiki

## Workflow

- **Per-phase PRs:** branch `feat/phase-N-<name>`, push, `gh pr create`, `/pr-review-toolkit:review-pr`, squash-merge. No direct commits to `main`.
- **Reviews matter:** every phase has surfaced 3–6 Critical+Important fixes. Budget ~15 min per phase.
- **Browser automation for eval:** use Chrome DevTools MCP tools (load via `ToolSearch select:mcp__chrome-devtools__*`) — drives localhost:3000 directly, can `evaluate_script` for DOM inspection. Faster than manual testing.

## Stack gotchas

- **Streamdown + rehype-harden strips aggressively:** custom element names → silently removed; non-standard URL schemes (`brain://`) → blocked with `[blocked]` label; unknown `data-*` attrs → dropped. Pass data via href fragment or className, and use custom mdast types (not `link`) with `hName: 'a'` to skip URL sanitizer.
- **Next 16 SSG:** `useSearchParams()` MUST be wrapped in `<Suspense>` or `next build` fails with "missing-suspense-with-csr-bailout".
- **Turbopack dev server does NOT hot-reload env var changes.** Restart `pnpm dev` after any `.env.local` edit.
- **AI SDK v6 onFinish signature:** `{ messages }` (not `{ uiMessages }`).
- **AI SDK `providerOptions.anthropic.cacheControl`:** must be on a `SystemModelMessage` parts-array, not a global agent option.

## Env vars (local dev)

- Refresh tokens: `vercel env pull .env.local --environment=development --yes` (OIDC expires ~12h).
- Then restart `pnpm dev`. Required keys land: `DATABASE_URL`, `REDIS_URL`, `KV_REST_API_URL`, `VERCEL_OIDC_TOKEN`, `APP_PASSWORD`, `AUTH_SECRET`, `WIKI_ROOT=./wiki/wiki`.
- Cannot read/write `.env*` from Claude's sandbox — use Cursor (`cursor .env.example`) or the user's shell.

## Gateway debugging

- **"Insufficient funds" often means expired OIDC token, not missing credits.** Decode JWT first: `node -e "const t=require('fs').readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('VERCEL_OIDC_TOKEN=')).split('=').slice(1).join('=');const p=JSON.parse(Buffer.from(t.split('.')[1],'base64url'));console.log('exp:',new Date(p.exp*1000),'team:',p.iss)"`. If expired, `vercel env pull .env.local --environment=development --yes` + restart dev.
- **`vercel deploy` / `vercel --prod` require `dangerouslyDisableSandbox: true`** from Claude's sandbox (lock-file EPERM in Vercel CLI cache).
- **DB diagnostic scripts also need sandbox disabled** (read `.env.local` for `DATABASE_URL`).

## Vercel CLI quirks

- `vercel env add <name> preview --yes` (no branch) is broken on v50–v51. Workaround: add with explicit branch name (`vercel env add NAME preview <branch-name> --value X --yes`; branch must exist on GitHub), or web dashboard for all-branches case.
- `drizzle-kit push --force` has interactive rename prompts it doesn't suppress. Use `node scripts/push-schema.mjs` (direct DDL) when schema has renames. Script has `CONFIRM_DROP_PROD` guard.

## DB query from shell

```bash
node -e "
const postgres = require('postgres');
const url = require('fs').readFileSync('.env.local','utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=').slice(1).join('=').replace(/^\"|\"$/g,'');
const sql = postgres(url, { max: 1 });
(async () => { console.log(await sql\`SELECT ... LIMIT 1\`); await sql.end(); })();
"
```

## Model config

- `lib/ai/models.ts` → `METIS_MODELS.{navigate,synthesize}` is the single source for model IDs. Currently both Sonnet 4.6. Two-tier routing (D11: Sonnet navigate + Opus synthesize) deferred to v1.5.
- `lib/safety/cost.ts` has per-model pricing tables — updates automatically when `METIS_MODELS` changes.

## Citation pipeline (D21)

- `components/metis/remark-brainlink.ts` emits custom mdast type `brainlink` (NOT `link`) with `data.hName='a'` + `href='#brainlink-<encoded-slug>'`.
- `lib/metis/citation-allowlist.ts` builds the **thread-wide** allowlist (aggregates `read_page`/`read_frontmatter` outputs across all prior assistant messages, not just the current turn). Called by `message.tsx` via `buildCitationContext`.
- `components/metis/message.tsx` accepts `priorMessages` prop from `ChatShell`; `components.a` detects `href.startsWith('#brainlink-')` and decodes slug from href.
- `lib/metis/error-classifier.ts` — `isGatewayBillingError()` classifies Gateway billing errors (anchored on "AI Gateway" prefix). Used by `useActiveChat.onError`.
- `components/metis/inline-citation.tsx` is a custom `<button>` pill — do NOT re-introduce `ai-elements/InlineCitationCardTrigger` (does `new URL(sources[0]).hostname` and throws on slugs).
- `lib/metis/brainlink-syntax.ts` is the ONE regex for `[[slug]]` parsing — shared between remark plugin and `persistAssistantTurn`. Do not drift.
