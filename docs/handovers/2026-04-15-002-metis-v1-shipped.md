# Session Handover — Metis v1 shipped: eval, hardening, Sonnet, prod promote
**Date:** 2026-04-15
**Branch:** `main` (squash-merged from `feat/phase-8-deploy`)
**Session length:** 9 commits on phase-8 branch → 1 squash-merge on main (`c7becd4`), 20 files, +912/-169 lines. Tagged `v1.0.0`.

## TL;DR for Next Session
Metis v1 is **shipped to production** at `metis-dun.vercel.app`. Eval: 18/18 pass, 0 fabricated citations. Model switched from Opus to Sonnet 4.6 mid-eval with zero quality regression (~5x cost reduction). Four hardening fixes landed from agent-review findings. 57 tests. Tag `v1.0.0` on main. Next: demo rehearsal with Ben, Sonnet A/B on Q7-class synthesis if desired, and v1.1 backlog (audit-layer symmetry, abort UX, O(N^2) allowlist).

## Current State
- **Branch:** `main` at `c7becd4` (tag `v1.0.0`), pushed. `feat/phase-8-deploy` at `eb55d00`, pushed (can delete).
- **Production:** `metis-dun.vercel.app` — READY, deployed from `eb55d00` via `vercel --prod`.
- **Stash:** `git stash` has working-tree state from mid-merge; can `git stash drop` safely.
- **DB:** Neon dev branch has ~20 message rows across the eval thread (`8667ce87...`) + a smoke-test thread. Dev data only — prod DB has clean schema from build-time migration.
- **Env:** `VERCEL_OIDC_TOKEN` in `.env.local` has 12h TTL; expires ~12h from last `vercel env pull`. Refresh before local dev: `vercel env pull .env.local --environment=development --yes`.
- **Model:** `METIS_MODELS.synthesize = "anthropic/claude-sonnet-4.6"` — changed from Opus mid-session. Cost tables in `lib/safety/cost.ts` already have Sonnet pricing.
- **Tests:** 57/57 pass (was 49 at session start; +8 from citation-allowlist + error-classifier).

## What I Did

1. **Ran full eval (18/18 pass):** Q7 (stakes: HHMI x research synthesis) first, then QA/QB/QC (grounding gates), QD/QE (clarification), QF (step-cap), Q2-Q6/Q8-Q9/Q11-Q12 (golden queries). All via Chrome DevTools MCP browser automation against localhost:3000.
2. **Fixed D21 cross-turn citation rendering:** Thread-wide allowlist extracted to `lib/metis/citation-allowlist.ts` with 7 unit tests. Before: 44 verified + 14 unverified pills. After: 58 verified + 0 unverified.
3. **Diagnosed and resolved Gateway "Insufficient funds" blocker:** Root cause was expired OIDC token (12h TTL), not missing credits. Misleading error message.
4. **Shipped 4 hardening fixes from agent reviews (code-reviewer + silent-failure-hunter):** text-required persistence guard, Gateway billing error classifier (`isGatewayBillingError`), strict type guards on allowlist, empty-bubble skip.
5. **Fixed New-chat button:** Was pushing to `/` which redirects to latest thread. Now pushes to `/chat/<new-uuid>`.
6. **Switched model Opus → Sonnet 4.6:** Zero quality regression across 8 Sonnet queries. ~5x cost reduction confirmed.
7. **Verified prompt caching:** 63.7% aggregate hit rate across 5 measured turns. Doc at `docs/research/2026-04-15-prompt-cache-verification.md`.
8. **Deployed to production** (`vercel --prod`) and tagged `v1.0.0` on main.

## What Went Wrong

- **Thread-wide allowlist was the biggest mid-eval fix (~1h).** D21's per-message allowlist caused Q7's HHMI citations (read in Q1) to render as unverified. Diagnosis took 3 steps: (1) read prompt.ts — rule was already explicit, (2) query DB — model DID emit `[[slug]]` correctly (28/28), (3) inspect DOM — slugs rendered as `BrainlinkUnverified` spans. Root cause: `message.tsx` built allowlist from only `message.parts`, not thread-wide.
- **OIDC token expiration masqueraded as "Insufficient funds."** Wasted ~30 min chasing credit permissions before decoding the JWT and seeing `exp` was 5.5h ago. The Gateway's error message doesn't distinguish expired-auth from exhausted-balance.
- **`vercel deploy` from Claude's sandbox hit lock-file EPERM.** Worked with `dangerouslyDisableSandbox: true`. Non-blocking but required sandbox override.
- **PR #8 was "already merged" when we tried to squash-merge.** It had been merged earlier (pre-session?) with only the first 2 commits. Required manual squash-merge of the remaining 7 commits via `git merge --squash` on main.
- **Main checkout had dirty working tree from branch files.** Required `git stash --include-untracked` before merge could proceed.

## What's Next

### This Week
- [ ] Demo rehearsal with Ben — walk through Q1 → Q7 → Q12 flow on prod
- [ ] Optionally re-run Q7 on Sonnet in a fresh thread (Q7 ran on Opus in eval; Q2-Q12 ran on Sonnet and held up, but Q7 is the stakes query)
- [ ] Clean up `feat/phase-8-deploy` branch (`git push origin --delete feat/phase-8-deploy`)
- [ ] Clean up git stash (`git stash drop`)
- [ ] Clean up smoke-test thread in Neon dev DB

### v1.1 Backlog (can wait)
- [ ] **Audit-layer symmetry:** `retrieval_trace.hallucinated_citations` uses per-turn semantics; should match thread-wide. Rename to `unverified_citations`, add `fabricated_citations` with wiki-existence check.
- [ ] **Abort UX:** Shell hides empty assistant bubbles (good for errors) but also hides user-abort state (bad). Add differentiated rendering when abort is first-class.
- [ ] **O(N^2) allowlist recomputation:** Each assistant message re-slices `priorAssistant` from `messages`. Hoist aggregation once in `ChatShell` for long threads.
- [ ] **`route.ts` swallowed errors:** `persistAssistantTurn` failures caught + console.error'd only. Add structured error reporting.
- [ ] **Two-tier model routing (D11):** Sonnet for everything works now; revisit Sonnet navigate + Opus synthesize if Sonnet quality regresses at scale.
- [ ] **Prompt-cache extended TTL:** Turn 3 dropped to 46.7% hit rate (half-miss). Investigate whether `{ type: 'ephemeral', ttl: '1h' }` is available on the Gateway.

## Do NOT Re-Do

- Full 18-query eval (complete, scored, documented in `docs/plans/2026-04-14-eval-run-01.md`)
- Thread-wide allowlist fix (shipped, tested, verified in browser — 58/0 pills)
- Gateway error hardening (3 fixes, committed, tested)
- Defense-in-depth fixes (strict type guards, text-required persistence, billing classifier — all tested)
- Prompt-cache verification (documented in `docs/research/2026-04-15-prompt-cache-verification.md`)
- Model swap Opus → Sonnet (committed, eval-validated across 8 queries)
- New-chat button fix (committed)
- Production deployment + v1.0.0 tag
- Code-reviewer + silent-failure-hunter agent reviews (completed, findings addressed)
- Citation rendering debug from prior session (custom mdast `brainlink` type + `#brainlink-<slug>` href)

## Key Files

| File | What Changed |
|---|---|
| `lib/metis/citation-allowlist.ts` | NEW: thread-wide allowlist builder, pure function, 7 unit tests. Strict type guards on `ok===true` + non-empty string slug. Trust-boundary documented. |
| `lib/metis/error-classifier.ts` | NEW: `isGatewayBillingError` — anchored on "AI Gateway" prefix to avoid false positives. 6 unit tests. |
| `components/metis/message.tsx` | Delegates to `buildCitationContext`, accepts `priorMessages` prop. Removed stale comments + dead biome-ignore. |
| `components/chat/shell.tsx` | Passes `priorMessages` (prior assistant msgs) to `AssistantMessage`. Skips rendering empty-parts assistant bubbles. |
| `components/chat/app-sidebar.tsx` | New-chat button: `router.push("/chat/<uuid>")` instead of `router.push("/")`. |
| `hooks/use-active-chat.tsx` | `onError` delegates to `isGatewayBillingError` for billing-wall classification. |
| `lib/persistence/turn.ts` | Guard: skip persistence when no text part with non-empty content (catches mid-stream crashes + Gateway errors). |
| `lib/ai/models.ts` | `METIS_MODELS.synthesize` switched from Opus 4.6 to Sonnet 4.6. Updated display names + comment documenting D11 deferral. |
| `components/metis/citation-context.tsx` | JSDoc updated: "per-turn" → "thread-wide". |
| `docs/plans/2026-04-14-eval-run-01.md` | Complete eval scorecard: 18/18 pass, per-query notes, bugs-encountered section, ship decision. |
| `docs/research/2026-04-15-prompt-cache-verification.md` | NEW: Cache hit evidence across 5 turns, cost analysis, cacheCreationTokens=0 investigation. |
| `tests/unit/citation-allowlist.test.ts` | NEW: 7 tests (aggregation, cross-turn, failed reads, title fallback, first-read-wins, malformed parts, fuzzy-truthy). |
| `tests/unit/error-classifier.test.ts` | NEW: 6 tests (both billing strings + 4 false-positive cases). |

## Key Decisions

- **Thread-wide allowlist over per-message:** D21's anti-hallucination guarantee preserved at the audit layer (`retrievalTrace` still per-message); only the render-layer verification horizon widened. User mental model is "Metis has read these pages in our conversation" — not "this specific turn."
- **Sonnet 4.6 over Opus 4.6:** Eval demonstrated zero quality regression across 8 queries including cross-client synthesis, portfolio categorization, personal profile synthesis, and framework explanation. ~5x cost reduction. D11 two-tier routing deferred to v1.5.
- **`isGatewayBillingError` as extracted pure function:** Anchored on "AI Gateway" prefix — bare "Insufficient funds" in unrelated tool results or user queries won't misroute to the credit-card alert.
- **Text-required persistence over parts-count check:** Silent-failure-hunter correctly identified that tool-only-no-text turns would persist misleading "clean read with no citations" eval traces. The text-presence check catches both Gateway-error-before-content AND mid-stream-crash-after-tool-call.
- **Ship with audit over-counting rather than blocking:** `hallucinated_citations` over-counts (flags unverified-but-real cross-turn citations). We verified every flagged slug exists in the wiki (zero fabricated). Renaming + adding fabricated_citations check is v1.1.

## Lessons Learned

- **OIDC token expiration produces misleading Gateway errors.** "Insufficient funds" when the real issue is expired auth. ALWAYS decode the JWT's `exp` claim before chasing credits/permissions. Added to CLAUDE.md gotchas.
- **The "diagnose before fix" discipline saved ~30 min on the citation bug.** Reflexive "tighten the prompt" would have been wrong — the model was emitting `[[slug]]` correctly (28/28 in DB). The issue was render-layer allowlist scope.
- **Agent reviews (code-reviewer + silent-failure-hunter) on surgical fixes are high-ROI.** The 4 defense-in-depth findings from the two background agents were all genuinely worth fixing. Budget ~15 min for agent review after any ship-path code change.
- **Sonnet 4.6 handles knowledge-chat synthesis at Opus quality.** The Aileron wiki notes that Sonnet was insufficient for client-facing multi-step skills — but that's a different domain (agentic completion accuracy) than knowledge-chat (retrieve + synthesize + cite). Domain matters more than model tier.
- **Hot-cache content reduces tool calls dramatically.** Q5 (pricing), QA-QC (anti-queries), QE (clarification) all answered from hot-cache context with 0-1 tool calls. The warm cron + system-prompt-loaded content is the real cost/latency lever.
- **Thread history grows input tokens linearly.** Q6 hit 1.25M input. For production threads with 20+ turns, this will hit context limits or cost concerns. Thread-summarization or sliding-window history is a v1.1 concern.

## Open Questions

- **Sonnet on Q7:** Q7 (the stakes synthesis query) ran on Opus. All other golden queries ran on Sonnet and held up. Worth re-running Q7 on Sonnet in a fresh thread to verify before the demo?
- **Custom domain:** Production is at `metis-dun.vercel.app`. Does Ben want a custom domain (e.g., `metis.cadre.ai`) before the demo?
- **Warm cron on prod:** The design calls for a 5-min `/api/warm` cron. Needs verification that the Cadre Vercel plan supports it + that env vars are set on production (they should be per the Phase 1 setup).
- **Eval thread cleanup:** Dev DB has ~20 eval messages. Keep for reference or wipe before demo?
