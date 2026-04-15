// proxy.ts — Next 16 Node-runtime request guard (replaces middleware.ts)
// Redirects unauthenticated requests to /login; passes through public paths.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "./app/(auth)/auth";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/warm"] as const;

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isPublic) {
    return NextResponse.next();
  }

  let session: Session | null;
  try {
    session = await auth();
  } catch (err) {
    console.error("[proxy] auth() failed", err);
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "session_invalid");
    return NextResponse.redirect(url);
  }
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\..*).*)"],
};
