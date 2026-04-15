// Suggestions endpoint removed in Metis v1 — artifacts feature was dropped in Phase 1.
export function GET() {
  return new Response("Suggestions endpoint removed", { status: 410 });
}
