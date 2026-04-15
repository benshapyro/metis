import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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
export async function enforceSpendCap(): Promise<SpendCheckOk | SpendCheckDenied> {
  const key = utcDayKey();
  const current = Number((await redis.get<number>(key)) ?? 0);
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
  if (usd <= 0) return;
  const key = utcDayKey();
  await redis.incrbyfloat(key, usd);
  await redis.expire(key, 60 * 60 * 26); // expire ~26h later (covers DST + clock skew)
}
