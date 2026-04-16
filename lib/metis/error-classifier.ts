// lib/metis/error-classifier.ts — pure, testable classifier for chat errors.
// Pulled out of useChat's onError so that the routing rules (which billing
// strings flip the credit-card alert vs. fall through to a generic toast)
// are exercised in unit tests instead of only in live Gateway-failure
// scenarios. We learned this lesson the hard way: the previous
// substring-match for "AI Gateway requires a valid credit card" silently
// missed the "Insufficient funds" wall and produced an empty UI.

// Both Gateway billing failures share the "AI Gateway: " prefix in their
// error message, which is what we anchor on. A bare "Insufficient funds"
// substring without that prefix could occur in unrelated contexts (a tool
// result echoing user text, a third-party 500, etc.) and we don't want to
// misroute those to the credit alert.
const GATEWAY_BILLING_PHRASES = [
  "requires a valid credit card",
  "Insufficient funds",
] as const;

export function isGatewayBillingError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  // Anchor on the AI Gateway prefix to avoid false positives. Both known
  // billing failures emit messages starting with "AI Gateway".
  if (!message.includes("AI Gateway")) {
    return false;
  }
  return GATEWAY_BILLING_PHRASES.some((phrase) => message.includes(phrase));
}
