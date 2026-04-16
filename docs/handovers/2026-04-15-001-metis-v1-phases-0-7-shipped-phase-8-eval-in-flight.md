# Session Handover — Metis v1: Phases 0–7 shipped, Phase 8 eval in flight
**Date:** 2026-04-15
**Branch:** `feat/phase-8-deploy`
**Session length:** Multi-phase mega-session → 2 commits on phase-8 branch (`0ebb019` Suspense fix, `25f1dc4` citation rendering fix); 8 prior phase PRs merged to main earlier in session.

## TL;DR for Next Session
Metis v1 is **code-complete and working locally** with real Cadre wiki + real AI Gateway. Citation pills render, source panel opens, D21 enforcement at 0 hallucinated across 30 tested. Phase 0–7 merged to main; Phase 8 PR is open but the current branch (`feat/phase-8-deploy`) has unpushed review eval docs and already-pushed citation fix. Next: continue the manual eval run (10 golden queries + 3 anti + 2 clarification + 1 step-cap + optional injection/stale), then redeploy preview and promote to prod.

## Current State
- **Branch:** `feat/phase-8-deploy`, 2 commits ahead of main (`0ebb019`, `25f1dc4`), **pushed**.
- **Uncommitted:** `docs/plans/2026-04-14-eval-run-01.md` (with Q1 + Q10 scored ✅) and `docs/plans/eval-hhmi-citations-working.png` (screenshot). Untracked, need commit.
- **PRs open:** `gh pr view 8` (Phase 8). Preview URL `https://metis-rb9nk33nw-cadre-ai.vercel.app` is from commit `0ebb019` — **stale relative to `25f1dc4`**; a redeploy is needed before preview-URL eval.
- **Production:** nothing deployed to prod yet.
- **Local dev:** `pnpm dev` was running at session end on `http://localhost:3000`. Shell may have exited — verify with `ps aux | grep "next dev"`. `VERCEL_OIDC_TOKEN` in `.env.local` expires ~12h after pull; re-pull before restart if stale.
- **DB:** Neon dev branch has live messages + retrieval_trace rows from this session's eval. 30 rendered citations across Q1 + Q10, `hallucinated_citations` empty across all.
- **Chrome DevTools MCP** is connected via an existing browser tab at localhost:3000. If you continue eval, just `mcp__chrome-devtools__list_pages` to resume.
- **Vercel env vars:** `WIKI_ROOT=./wiki/wiki` is set in all 3 envs (prod/preview/dev). `AUTH_SECRET` + `APP_PASSWORD` only in prod + dev + preview-for-`feat/phase-8-deploy` branch (CLI bug prevents cross-branch preview). For main-branch preview deploys, they'll need to be added via web dashboard.

## What I Did

1. **Executed Phases 3–8 end-to-end** via subagent-driven-development per the Metis v1 plan (`docs/plans/2026-04-14-metis-v1-plan.md`). Each phase: multi-agent `/pr-review-toolkit:review-pr` → fix-pass subagent → squash-merge. Roll-up of phase merges to main: `906666b` Phase 1, `9b827cf` Phase 2, `2b9a7a8` Phase 3, `c861a03` Phase 4, `f24222b` Phase 5, `42fc0d0` Phase 6, `6477bdf` Phase 7 (`a01f377` Phase 0 was from the previous session).
2. **Phase 8 deploy unblocker cascade:**
   - Build failed: `useSearchParams()` in login page without `<Suspense>` for Next 16 SSG → wrapped in `<Suspense>` (`0ebb019`).
   - Dev server 500'd: `WIKI_ROOT` env var never added to Vercel → added to all 3 envs, re-pulled `.env.local`.
   - Citations not rendering as pills: debugged layer-by-layer with Chrome DevTools MCP direct browser automation. Found 3 distinct bugs stacked on top of each other. Fixed (`25f1dc4`).
3. **Validated the end-to-end system via browser automation:** logged into local Metis, ran Q10 (POV on context engineering) and Q1 (HHMI engagement state). Both returned cited narratives with 13+ / 17+ verified citation pills, source panel opens correctly, zero hallucinated citations. Screenshot saved: `docs/plans/eval-hhmi-citations-working.png`.
4. **Created eval-run doc** at `docs/plans/2026-04-14-eval-run-01.md` and scored Q1 + Q10 as ✅ PASS with detailed notes.

## What Went Wrong

- **Three-layered citation bug (took ~5 iterations in Chrome DevTools to diagnose):**
  1. First attempt used custom element names (`<brainlink>`, `<brainlink-unverified>`). Streamdown's `rehype-harden` silently strips non-standard HTML elements. Result: `[[slug]]` markers erased entirely from DOM.
  2. Second attempt used `brain://slug` href on a mdast `link` node. Streamdown's URL sanitizer blocks custom URL schemes with `"Blocked URL: undefined"` label. Result: text rendered but as "[blocked]" string.
  3. Third attempt used `#brainlink-<slug>` fragment href + `data-*` attributes on mdast `link` node. Streamdown's URL sanitizer STILL runs on `link` nodes (validates `node.url`). Result: still blocked.
  4. Fourth attempt used custom mdast type `brainlink` (NOT `link`) with `hName: 'a'` + fragment href + data attrs. Anchors rendered cleanly BUT rehype-harden stripped the `data-*` attrs. Fallback branch hit in `components.a`. Result: plain `<a>` not custom pill.
  5. Final fix: custom mdast type + fragment href as the only signal channel (no data-*). `components.a` detects `href.startsWith('#brainlink-')` and parses slug from there.
- **Also: `ai-elements/InlineCitationCardTrigger` runtime error** — it does `new URL(sources[0]).hostname` which throws on wiki slugs like `concepts/context-engineering`. Replaced the whole component with a lean custom `<button>` pill.
- **Vercel CLI `env add preview --yes` is broken across multiple CLI versions (50.37.1 and 51.1.0).** Requires specific branch name that must exist on GitHub first. Documented workaround in the Phase 1 handover (set vars on the specific branch after pushing it) and via web dashboard for all-branches case.
- **`drizzle-kit push --force` has interactive rename prompts that `--force` doesn't suppress.** Worked around via `scripts/push-schema.mjs` (direct postgres DDL). Script now has a `CONFIRM_DROP_PROD` guard after a code review flagged it.
- **AI SDK v6 onFinish callback signature regression caught in review:** uses `{ messages }` not `{ uiMessages }` (implementer wrote the wrong one; fixed in `908a810` / merged as part of Phase 6).

## What's Next

### Blockers (before anything else)
- [ ] Commit the uncommitted eval-run doc + screenshot to phase-8 branch

### This Week
- [ ] Continue eval run — 10 golden queries remain (Q2 Aileron meeting prep, Q3 CES prep, Q4 ROPE, Q5 shaping pricing, Q6 tech-fit hierarchy, **Q7 HHMI × adoption synthesis — stakes moment**, Q8 vendor eval patterns, Q9 org readiness, Q11 Karpathy LLM wiki, Q12 Ben profile). Chrome DevTools MCP remains the fastest path.
- [ ] Run anti-queries QA/QB/QC (must trigger grounding gate).
- [ ] Run clarification queries QD/QE (must ask before tool calls).
- [ ] Run step-cap query QF (must hit `stopWhen: stepCountIs(12)` with partial-answer disclaimer).
- [ ] Redeploy preview (`vercel deploy`) so `feat/phase-8-deploy` preview URL reflects `25f1dc4`.
- [ ] Optional: seed `wiki/test/prompt-injection-probe.md` for QG, then delete + bump submodule pointer afterward.
- [ ] Optional: test QH (stale citation) after seeding + deleting a test page.
- [ ] Promote to production via `vercel --prod` once eval ≥80% pass + zero hallucinations.

### Next Session (can wait)
- [ ] Squash-merge Phase 8 PR #8 after production is live.
- [ ] Run `/pr-review-toolkit:review-pr` on the full squashed v1.
- [ ] Tag `v1.0.0`.
- [ ] Demo-rehearsal pass with Ben.
- [ ] Handover documentation for Cadre team + leadership-demo script.

## Do NOT Re-Do

- Brainstorming, design doc, plan, decisions log, research reports, eval set, prompt skeleton — all written + committed in prior session.
- Phase 0–7 implementation — all merged to main.
- Phase 3–7 multi-agent review cycles + fix passes — all addressed + merged.
- Citation-rendering debugging — done (final approach: custom mdast type `brainlink` + fragment-href signal channel + custom pill button).
- Login page Suspense fix — in commit `0ebb019`.
- `WIKI_ROOT` env var provisioning — done on all 3 Vercel envs.
- Chrome DevTools MCP setup — already connected to localhost:3000.

## Key Files

| File | What Changed |
|---|---|
| `components/metis/remark-brainlink.ts` | Final working approach: emits mdast nodes of custom type `brainlink` with `data.hName='a'` + `href='#brainlink-<encoded-slug>'`. URL is a same-origin fragment (survives rehype-harden). Slug/label/verified round-tripped on `data.*` for tests/persistence. |
| `components/metis/message.tsx` | `components.a` override keys off `href.startsWith('#brainlink-')` and decodes the slug from the href (rehype-harden strips `data-*`). Falls through to plain anchor otherwise. |
| `components/metis/inline-citation.tsx` | Completely rewrote. Was using `ai-elements/InlineCitationCardTrigger` which does `new URL(sources[0]).hostname` and throws on wiki slugs. Now a lean custom `<button>` pill with Tailwind styling + `title` tooltip + amber-ring for weak confidence/coverage. |
| `tests/unit/remark-brainlink.test.ts` | Updated assertions to check `node.type === 'brainlink'` + `node.data.{slug,label,verified}` round-trip instead of previous custom-node-type shape. |
| `app/(auth)/login/page.tsx` | Extracted `LoginForm` inner component, wrapped in `<Suspense fallback={null}>` so Next 16 SSG pass doesn't bail out on `useSearchParams()`. |
| `docs/plans/2026-04-14-eval-run-01.md` | Created eval scratchpad; Q1 + Q10 scored PASS with detailed verification notes. |
| `docs/plans/eval-hhmi-citations-working.png` | Screenshot evidence of Q1 HHMI response rendering with working citation pills. |

## Key Decisions

- **Replaced `ai-elements/InlineCitationCardTrigger` with a custom pill.** The ai-elements component assumes sources are full URLs for hostname extraction. Wiki slugs aren't URLs. Rather than shoehorn slugs into URL form, built a lean Tailwind button. Cost: ~15 lines of extra code. Benefit: no runtime errors, matches our information shape cleanly.
- **Chose href as the only signal channel (not `data-*` attributes).** rehype-harden strips unknown `data-*` attributes. Fragment href survives sanitization AND carries the slug. Component does a single `decodeURIComponent` to recover.
- **Custom mdast type `brainlink` instead of `link`.** Streamdown's URL sanitizer only runs on `link` nodes. Custom types with `hName: 'a'` pass through to `<a>` via `mdast-util-to-hast`'s fallback behavior, entirely bypassing the URL sanitizer.
- **Used Chrome DevTools MCP (not claude-in-chrome) for browser automation.** The claude-in-chrome extension needed to be started manually; Chrome DevTools MCP was already available and could drive the browser + execute JavaScript for DOM inspection. Saved ~20 minutes vs. asking the user to install the extension.
- **Skipped Preview env setup for `main` branch preview deploys.** The `vercel env add preview --yes` CLI bug requires either a specific existing branch OR manual web dashboard setup. Deferred to pre-production-deploy checklist; not blocking eval work on `feat/phase-8-deploy` preview.

## Lessons Learned

- **Streamdown/rehype-harden is aggressive and opaque.** Silently strips custom elements, blocks custom URL schemes (`brain://`), strips unknown `data-*` attrs, and runs URL validation on `link` mdast nodes before any hProperties override. Any custom mdast plugin that wants to reach React components must use either (a) a standard HTML tag via `hName` on a custom node type + encode data in href/class, or (b) accept text transformation only. Don't try to pass structured data via data attributes through Streamdown.
- **Next 16 SSG is strict on `useSearchParams()`.** Any client component using it must be wrapped in `<Suspense>` or the static prerender pass fails with a cryptic "missing-suspense-with-csr-bailout" error.
- **Vercel's `VERCEL_OIDC_TOKEN` for AI Gateway auth expires every ~12 hours** for local dev. If `/api/chat` starts returning 401s from the Gateway, run `vercel env pull .env.local --environment=development` + restart dev server.
- **`pnpm dev` with Turbopack does NOT hot-reload env var changes.** Must fully restart the dev server after `vercel env pull`.
- **Chrome DevTools MCP for in-session browser automation is fast.** `evaluate_script` returning structured JSON of the DOM made diagnosis of the citation rendering bug quick — the a11y tree showed generic `StaticText` nodes (no custom elements), the raw HTML showed `"Blocked URL: undefined"`, and the script return value confirmed our `components.a` fallback was hitting without `data-*` attrs. Three data points in three tool calls.
- **AI SDK v6 `onFinish` signature is `{ messages }`, not `{ uiMessages }`.** The docs string has both names floating around; the actual callback type in `ai/dist/index.d.ts` uses `messages`.
- **The multi-agent PR review (code-reviewer + silent-failure-hunter + type-design-analyzer + comment-analyzer) consistently surfaces real issues.** Every Phase 3–7 review yielded 3–6 Critical + Important fixes that tightened the trust architecture. Worth the 10–15 min latency each phase.

## Open Questions

- **Preview env vars for `main` branch deploys:** when we squash-merge Phase 8, the PR preview built on `main` won't have `AUTH_SECRET` or `APP_PASSWORD` (they're scoped to `feat/phase-8-deploy`). Add via web dashboard before merging? Or add to Production only + skip Preview for main?
- **Vercel Cron limits:** the implementer during Phase 0 was unable to fetch them and left a `Finding:` note in design doc §14. Worth confirming before production promotion that the 5-min `/api/warm` cron is viable on the Cadre plan.
- **Prompt caching verification:** Anthropic `cacheControl: { type: 'ephemeral' }` is in place in `lib/metis/agent.ts` but we haven't verified actual cache-hit rate via `providerMetadata.anthropic.cacheCreationInputTokens` in a real request. Worth checking against the DB `retrieval_trace.model_calls` JSON payload to confirm caching fires — it was flagged as a verification todo during the Phase 3 review.
- **Two-tier model routing** (D11: Sonnet navigation + Opus synthesis) is explicitly v1.5 — currently single-model Opus for everything. Cost impact at demo scale is negligible; revisit when query volume grows.
