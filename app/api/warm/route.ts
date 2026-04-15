// /api/warm — pre-warm hot caches. Called by Vercel Cron every 5 minutes.
// Listed in PUBLIC_PATHS in proxy.ts so no auth cookie is required.
import { NextResponse } from "next/server";
import { forceReloadHotCaches } from "@/lib/metis/hot-caches";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cache = await forceReloadHotCaches();
    console.log(`[warm] reloaded hot caches: ${cache.totalChars} chars`);
    return NextResponse.json({ ok: true, hotCachesChars: cache.totalChars });
  } catch (err) {
    // High-severity: sustained warm failures mean cold caches forever; check
    // wiki submodule deployment + Upstash availability.
    console.error("[warm] forceReloadHotCaches failed (severity: high):", err);
    return NextResponse.json(
      { ok: false, error: String(err), severity: "high" },
      { status: 500 }
    );
  }
}
