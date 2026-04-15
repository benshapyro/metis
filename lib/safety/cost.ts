// USD per million tokens. Update when pricing shifts; verify against
// Anthropic docs + Gateway markup.
const PRICING: Record<
  string,
  { in: number; out: number; cacheRead: number; cacheWrite: number }
> = {
  "anthropic/claude-opus-4.6": {
    in: 15,
    out: 75,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  "anthropic/claude-sonnet-4.6": {
    in: 3,
    out: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
};

export interface UsageInput {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
}

export function estimateCostUSD({
  model,
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
  cacheCreationTokens = 0,
}: UsageInput): number {
  const p = PRICING[model];
  if (!p) {
    console.error(
      `[cost] unknown model "${model}" — using Opus pricing as upper bound (cap may overshoot)`
    );
    // Pessimistic worst-case so spend cap still fires
    return (inputTokens * 15 + outputTokens * 75) / 1_000_000;
  }
  const uncachedIn = Math.max(
    0,
    inputTokens - cachedInputTokens - cacheCreationTokens
  );
  return (
    (uncachedIn * p.in +
      cachedInputTokens * p.cacheRead +
      cacheCreationTokens * p.cacheWrite +
      outputTokens * p.out) /
    1_000_000
  );
}
