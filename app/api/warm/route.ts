// /api/warm — pre-warm hot caches. Called by Vercel Cron every 5 minutes.
// Listed in PUBLIC_PATHS in proxy.ts so no auth cookie is required.
import { NextResponse } from "next/server";
import { forceReloadHotCaches } from "@/lib/metis/hot-caches";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cache = await forceReloadHotCaches();
    return NextResponse.json({ ok: true, hotCachesChars: cache.totalChars });
  } catch (err) {
    console.error("[warm] forceReloadHotCaches failed:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
