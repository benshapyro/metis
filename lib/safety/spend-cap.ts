import { Redis } from "@upstash/redis";

/**
 * IMPORTANT: `recordSpend` is wired into the chat route's onFinish hook in Phase 6.
 * Until that lands, this cap is DECORATIVE — the counter is never incremented,
 * so `enforceSpendCap` always returns ok=true. Do NOT promote to production
 * before Phase 6 (`persistAssistantTurn`) is in place.
 *
 * Documented TOCTOU window: parallel requests near the cap can each pass
 * `enforceSpendCap` simultaneously and collectively overshoot by ~$N×avg-turn-cost.
 * At Cadre scale (~5 concurrent users) overshoot is cents. Revisit at higher scale.
 */

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (_redis) {
    return _redis;
  }
  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
    throw new Error("Spend cap unavailable: Upstash env vars not configured");
  }
  _redis = Redis.fromEnv();
  return _redis;
}

export const DAILY_CAP_USD = 50;

function utcDayKey(): string {
  const d = new Date();
  return `metis:spend:${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export interface SpendCheckOk {
  ok: true;
  spentUsd: number;
}

export interface SpendCheckDenied {
  ok: false;
  message: string;
  spentUsd: number;
}

/**
 * Verify the day's spend hasn't crossed the hard cap.
 * Called on every /api/chat request before invoking the agent.
 */
export async function enforceSpendCap(): Promise<
  SpendCheckOk | SpendCheckDenied
> {
  const key = utcDayKey();
  const current = Number((await getRedis().get<number>(key)) ?? 0);
  if (current >= DAILY_CAP_USD) {
    return {
      ok: false,
      message: "Daily spend cap reached — chat resumes at UTC 00:00.",
      spentUsd: current,
    };
  }
  return { ok: true, spentUsd: current };
}

/**
 * Record cost in USD against today's running total.
 * Called from the chat route's onFinish handler once per assistant turn.
 */
export async function recordSpend(usd: number): Promise<void> {
  if (usd <= 0) {
    return;
  }
  const key = utcDayKey();
  await getRedis().incrbyfloat(key, usd);
  await getRedis().expire(key, 60 * 60 * 26); // expire ~26h later (covers DST + clock skew)
}
