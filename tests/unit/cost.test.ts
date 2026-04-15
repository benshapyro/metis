import { describe, expect, it } from "vitest";

import { estimateCostUSD } from "@/lib/safety/cost";

describe("estimateCostUSD", () => {
  it("computes cost for sonnet-4.6", () => {
    const c = estimateCostUSD({
      model: "anthropic/claude-sonnet-4.6",
      inputTokens: 10_000,
      outputTokens: 2000,
      cachedInputTokens: 8000,
    });
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0.1);
  });

  it("opus is more expensive than sonnet at same usage", () => {
    const usage = { inputTokens: 10_000, outputTokens: 2000 };
    const opus = estimateCostUSD({
      model: "anthropic/claude-opus-4.6",
      ...usage,
    });
    const sonnet = estimateCostUSD({
      model: "anthropic/claude-sonnet-4.6",
      ...usage,
    });
    expect(opus).toBeGreaterThan(sonnet);
  });

  it("unknown model returns 0", () => {
    expect(
      estimateCostUSD({
        model: "foo/bar",
        inputTokens: 1000,
        outputTokens: 100,
      })
    ).toBe(0);
  });

  it("cached tokens cost less than uncached", () => {
    const cached = estimateCostUSD({
      model: "anthropic/claude-sonnet-4.6",
      inputTokens: 10_000,
      outputTokens: 0,
      cachedInputTokens: 10_000,
    });
    const uncached = estimateCostUSD({
      model: "anthropic/claude-sonnet-4.6",
      inputTokens: 10_000,
      outputTokens: 0,
    });
    expect(cached).toBeLessThan(uncached);
  });
});
