// Vote endpoint removed in Metis v1 — replaced by /api/feedback (POST rating).
// Returning 410 Gone so existing clients surface a clear error rather than hanging.
export function GET() {
  return new Response("Vote endpoint removed — use /api/feedback", {
    status: 410,
  });
}

export function PATCH() {
  return new Response("Vote endpoint removed — use /api/feedback", {
    status: 410,
  });
}
