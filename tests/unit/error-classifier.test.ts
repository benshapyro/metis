import { describe, expect, it } from "vitest";
import { isGatewayBillingError } from "@/lib/metis/error-classifier";

describe("isGatewayBillingError", () => {
  it("matches the missing-credit-card wall", () => {
    expect(
      isGatewayBillingError("AI Gateway requires a valid credit card.")
    ).toBe(true);
  });

  it("matches the exhausted-balance wall", () => {
    expect(
      isGatewayBillingError(
        "AI Gateway: Insufficient funds. Please add credits..."
      )
    ).toBe(true);
  });

  it("returns false for unrelated errors mentioning 'Insufficient funds'", () => {
    // Tool result echo, third-party 500, or user query feedback that happens
    // to contain the phrase but isn't a Gateway billing failure.
    expect(
      isGatewayBillingError(
        "Bad request: 'How do banks handle insufficient funds?'"
      )
    ).toBe(false);
    expect(
      isGatewayBillingError("Tool error: search returned 'insufficient funds'")
    ).toBe(false);
  });

  it("returns false for unrelated errors mentioning 'credit card'", () => {
    expect(
      isGatewayBillingError(
        "Validation error: credit card number must be 16 digits"
      )
    ).toBe(false);
  });

  it("returns false for empty / undefined messages", () => {
    expect(isGatewayBillingError(undefined)).toBe(false);
    expect(isGatewayBillingError("")).toBe(false);
  });

  it("returns false for AI Gateway errors that aren't billing-related", () => {
    expect(isGatewayBillingError("AI Gateway: Rate limit exceeded")).toBe(
      false
    );
    expect(isGatewayBillingError("AI Gateway: Model not found")).toBe(false);
  });
});
