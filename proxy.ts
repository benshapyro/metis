// proxy.ts — Next 16 Node-runtime request guard (replaces middleware.ts)
// Redirects unauthenticated requests to /login; passes through public paths.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "./app/(auth)/auth";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/warm"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await auth();
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
