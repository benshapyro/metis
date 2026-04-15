import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit {
  if (_limiter) {
    return _limiter;
  }
  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
    throw new Error(
      "Rate limiter unavailable: UPSTASH_REDIS_REST_URL / KV_REST_API_URL not configured"
    );
  }
  _limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, "1 h"),
    analytics: true,
    prefix: "metis:rl",
  });
  return _limiter;
}

export interface RateLimitResult {
  ok: true;
}

export interface RateLimitDenied {
  ok: false;
  message: string;
  retryAfterMs: number;
}

export async function enforceRateLimit({
  sessionId,
  ip,
}: {
  sessionId: string;
  ip: string;
}): Promise<RateLimitResult | RateLimitDenied> {
  const key = `${sessionId}:${ip}`;
  const { success, reset } = await getLimiter().limit(key);
  if (success) {
    return { ok: true };
  }
  const retryAfterMs = Math.max(0, reset - Date.now());
  const retryMinutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return {
    ok: false,
    message: `You've hit the hourly rate limit (30/hr). Next window opens in ~${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
    retryAfterMs,
  };
}
