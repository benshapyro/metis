import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: true,
  prefix: "metis:rl",
});

export interface RateLimitResult {
  ok: true;
}

export interface RateLimitDenied {
  ok: false;
  message: string;
  retryAfterMs: number;
}

export async function enforceRateLimit(
  { sessionId, ip }: { sessionId: string; ip: string },
): Promise<RateLimitResult | RateLimitDenied> {
  const key = `${sessionId}:${ip}`;
  const { success, reset } = await limiter.limit(key);
  if (success) return { ok: true };
  const retryAfterMs = reset - Date.now();
  return {
    ok: false,
    message: `You've hit the hourly rate limit (30/hr). Next window opens in ${Math.ceil(retryAfterMs / 60_000)} minutes.`,
    retryAfterMs,
  };
}
