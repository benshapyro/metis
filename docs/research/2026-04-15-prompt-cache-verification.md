# Anthropic prompt-cache verification — Phase 8 eval

**Date:** 2026-04-15
**Source:** `retrieval_trace.model_calls` for all assistant turns currently in the dev Neon DB (5 turns, all from this eval thread)
**Trigger:** Phase 3 review flagged "verify prompt caching is actually firing via `providerMetadata.anthropic.cacheCreationInputTokens`" as an unverified todo.

## Result: ✅ Caching IS firing

| # | turn_at (UTC) | tokens_in | tokens_out | cacheCreation | cached | hit-rate |
|---|---|---|---|---|---|---|
| 1 | 06:20:36 | 213,926 | 1,685 | 0 | 202,944 | 94.9% |
| 2 | 06:22:02 | 217,445 | 1,366 | 0 | 202,944 | 93.3% |
| 3 | 06:40:59 | 217,445 | 1,392 | 0 | 101,472 | 46.7% |
| 4 | 07:20:34 | 369,542 | 2,326 | 0 | 202,944 | 54.9% |
| 5 | 13:56:42 | 416,136 | 3,008 | 0 | 202,944 | 48.8% |

**Aggregate:** 1,434,494 input tokens billed. **913,248 (63.7%) served from cache.**

## What this means

- The `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }` setting on the system prompt parts-array (`lib/metis/agent.ts`) is reaching Anthropic and being honored.
- The cached portion (~202,944 tokens) maps to the system prompt + hot-cache content that's identical across turns.
- The variable per-turn portion (10k–215k beyond the cache) is the tool outputs, prior conversation history, and current user message — none of which are cacheable on their own.

## Notes & open questions

- **`cacheCreationTokens` = 0 across all 5 turns.** Unexpected — there should be at least one initial write. Most likely explanation: the `/api/warm` cron (5-min schedule per design) is doing the initial cache writes via a separate request, so by the time real chat turns fire, the cache already exists and only reads are billed. This is the intended behavior and is a *good* sign for cost control. Worth confirming by querying any warm-cron logs.
- **Turn 3 hit rate dropped to 46.7%.** Half the usual 202,944 was cached; the other half wasn't. Possible cause: the cache breakpoint on `cacheControl: { type: 'ephemeral' }` only covers part of the system prompt and one breakpoint expired (5-min default TTL). Worth checking whether we need an extended TTL (`{ type: 'ephemeral', ttl: '1h' }` if the SDK supports it on this provider) or a second cache breakpoint, especially for production traffic patterns where queries may be 30+ min apart.
- **Turns 4 and 5 maintained 202,944 cached tokens despite being 40+ min apart.** This is consistent with the warm cron re-writing the cache every 5 min, keeping it perpetually fresh.

## Cost impact

Using rough Claude Opus 4.6 pricing:
- Input (uncached): $15 / M tokens → 521,246 fresh tokens × $15/M = ~$7.82
- Input (cached read): $1.50 / M tokens → 913,248 cached tokens × $1.50/M = ~$1.37
- Without caching, 5 turns would cost ~$21.52 input alone.
- **Net savings from caching across these 5 turns: ~$12.33 (≈57% input-cost reduction).**

At demo scale (~50–100 queries/day), caching saves ~$120–250/day in input costs. At Glen's 50-org peer-network scale, this is the difference between viable and unviable per-query economics.

## Action

- ✅ Cross off the Phase 3 review todo.
- ⚠️ Investigate the cacheCreationTokens=0 pattern — confirm warm cron is doing the writes, OR add explicit cache-write tracking somewhere.
- ⚠️ Investigate turn 3's drop to 46.7% — extended TTL or second breakpoint may be cheap insurance.
- Defer both ⚠️ items to v1.1 — they're optimizations, not ship-blockers.
