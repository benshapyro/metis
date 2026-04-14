# Next.js 16 + Infra Pre-Build Verification

Date: 2026-04-14
Scope: Pre-build sanity check for Next.js 16 and supporting packages.

## Source availability

- Next.js docs via WebFetch to `nextjs.org/docs/*` — **worked** (doc version 16.2.3, lastUpdated 2026-04-10).
- Vercel docs via WebFetch to `vercel.com/docs/*` — **worked**.
- Context7 `resolve-library-id` and `query-docs` — **blocked in this session** (permission denied).
- WebFetch to `github.com`, `npmjs.com`, `orm.drizzle.team` — **blocked in this session** (permission denied).
- WebSearch — **blocked**.
- Vercel `nextjs` skill reference files — **Read denied** in this session.

Where a third-party package could not be verified from a live source, I flag it and fall back to the last known stable API. Do not treat those sections as authoritative — re-check before build.

---

## Next.js 16

Version observed in live docs: **16.2.3** (April 10, 2026).

### 1. `outputFileTracingIncludes`

Still the correct knob. Confirmed syntax (`next.config.js` or `next.config.ts`):

```ts
// next.config.ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/chat': ['./wiki/**/*.md'],
    // or target everything:
    // '/*': ['./wiki/**/*.md'],
  },
}
export default nextConfig
```

Keys are **route globs** (picomatch); values are **globs resolved from the Next.js project root** (i.e., the folder with `next.config.*`, *not* the monorepo root).

Gotchas:
- **Only applies to server-traced routes.** Edge routes and fully-static pages are unaffected — fine for us, `/api/chat` is Node.
- **Monorepo:** project root = `packages/app` (wherever `next.config.*` lives). If your `wiki/` submodule lives *above* the Next app, set `outputFileTracingRoot: path.join(__dirname, '../../')` and reference `../wiki/**/*` relative to project root (or absolute from the new root).
- Prefer forward slashes; keep globs narrow to avoid bloated traces.
- Route keys with bracket params must be escaped, e.g. `'/api/login/\\[\\[\\.\\.\\.slug\\]\\]'`.

### 2. Route-level Node runtime

```ts
// app/api/chat/route.ts
export const runtime = 'nodejs' // 'nodejs' | 'edge'
```

- **`'nodejs'` is the default** in Next 16. You only need to set this explicitly if you want to opt into Edge.
- `experimental-edge` is gone (removed in 15.0 RC, codemod available).
- **Edge is NOT supported under Cache Components**, and **cannot** be used inside `proxy.ts` (see below).

### 3. Middleware → `proxy` (BREAKING, Next 16)

Middleware has been renamed to **Proxy**. `middleware.ts` → `proxy.ts`, `export function middleware` → `export function proxy`. Config flags renamed (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). Codemod: `npx @next/codemod@canary middleware-to-proxy .`.

Runtime affinity change: **Proxy always runs on Node.js. The `runtime` option is not configurable in `proxy.ts` — setting it throws.** If you need Edge, keep the file named `middleware.ts` (Vercel explicitly preserved that escape hatch; full guidance promised in a follow-up minor).

Auth pattern (shared-password gate + session cookie):

```ts
// proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
  const session = req.cookies.get('mbs_session')
  if (!session && req.nextUrl.pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  const res = NextResponse.next()
  // iron-session sets its own cookie via getIronSession in the login route.
  return res
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|login|favicon.ico).*)'],
}
```

Security note in the 16 docs: a Proxy `matcher` that excludes a path also skips Server Action POSTs to that path — **always re-check auth inside Server Actions**, don't rely solely on Proxy.

### 4. Cache Components / `use cache`

Stable in 16.0. Toggle with `cacheComponents: true` (replaces `experimental.dynamicIO` and `experimental.ppr`; single unified flag).

Relevance to us: **not now.** Our app is predominantly dynamic (chat, session, rate-limited API). Enabling `cacheComponents` switches the default to "uncached unless opted in" and requires reasoning about `'use cache'` boundaries, `cacheLife`, and closed-over vars — extra complexity for minimal gain. Keep it off for v1. Revisit if we add a public content surface (e.g., shared wiki excerpts) that benefits from PPR.

Also note: **`dynamic`, `dynamicParams`, `revalidate`, `fetchCache` route segment configs are removed when `cacheComponents` is enabled.** Another reason to leave it off unless we commit to the migration.

### 5. `next.config.ts` vs `next.config.js`

Both fully supported. `.ts` is preferred for TS projects:

```ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { /* ... */ }
export default nextConfig
```

`.cjs` and `.cts` are **not** supported. `.mjs` is fine.

### 6. Vercel Cron for `/api/warm`

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/warm", "schedule": "*/5 * * * *" }
  ]
}
```

- Trigger = **HTTP GET** to the production deployment URL. User-agent `vercel-cron/1.0` (use it for auth gating, plus a `CRON_SECRET` header check).
- UTC only. No `MON`/`JAN` aliases. Can't set day-of-month and day-of-week simultaneously.
- Limits change by plan; see `vercel.com/docs/cron-jobs/usage-and-pricing`. On Hobby you'll hit both count and frequency caps — verify before committing to `*/5`. I couldn't fetch the limits page in this session; confirm before shipping.

### 7. Other Next 16 changes that touch our wiring

- **Turbopack is the default** for both `dev` and `build`. Drop `--turbopack` flags. If you have a custom webpack config, `next build` fails unless you use `--webpack` or migrate.
- **`revalidateTag` now requires a second arg** (a `cacheLife` profile). `revalidateTag('posts', 'max')`. Use `updateTag` in Server Actions for read-your-writes semantics.
- **Async Request APIs are fully enforced.** `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` are all `Promise`-returning; synchronous access is removed. Use `await cookies()` etc.
- **Node.js 20.9+**, **TypeScript 5.1+** required.
- `serverRuntimeConfig` / `publicRuntimeConfig` removed — use env vars. For runtime (not build-time) env reads, call `await connection()` first.
- Parallel-route slots now **require** a `default.js`.
- `next lint` is gone; run ESLint/Biome directly.
- `next/image`: `minimumCacheTTL` default bumped 60s → 4h, `qualities` default now `[75]` only, `images.domains` deprecated (use `remotePatterns`), local images with `?` query strings now require `images.localPatterns.search`.

---

## iron-session

**Could not verify against a live source this session** (GitHub + npmjs WebFetch blocked, Context7 denied). Based on the last stable 8.x line:

- Version line: **8.x**. Re-check `npm view iron-session version` before commit.
- Supports: `HttpOnly` (always on), `secure`, `sameSite: 'strict'`, `maxAge` (ttl in seconds), and **password rotation** via an object map `{ 2: 'new-pw', 1: 'old-pw' }` — highest numeric key is used to encrypt; all keys decrypt.
- Signing uses `@hapi/iron` (AES-256-CBC for encryption, HMAC-SHA256 for integrity). It is stronger than HS256, not weaker.
- Cookie rotation: change the password map on the server. Next request that hits `getIronSession` re-encrypts with the new key on save; old cookies still decrypt during the overlap. No manual re-issue needed.
- App Router usage:

```ts
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    cookieName: 'mbs_session',
    password: { 2: process.env.SESSION_PW_V2!, 1: process.env.SESSION_PW_V1! },
    ttl: 60 * 60 * 24 * 7, // 7 days
    cookieOptions: { secure: true, sameSite: 'strict', httpOnly: true },
  })
}
```

- Regenerate on login: `session.destroy(); session.user = ...; await session.save();`.

**Action item:** confirm 8.x is still current and that the Next 16 `await cookies()` interop is unchanged before committing.

---

## Upstash Ratelimit

**Could not verify against a live source** (npmjs + GitHub blocked). Based on the stable `@upstash/ratelimit` API:

- Version line: **2.x** (re-check).
- `identifier` is a **single string**. Composite keys are built by the caller: `` `${sessionId}:${ip}` ``. There is no first-class multi-key API.
- Algorithms: `slidingWindow`, `tokenBucket`, `fixedWindow`, `cachedFixedWindow` — all still present.
- Vercel Marketplace: installing Upstash Redis **auto-injects** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (plus `KV_*` aliases for legacy compat). No manual token step. Confirmed via Vercel's Redis docs: "credentials and environment variables injected into your Vercel project." The old Vercel KV was migrated to Upstash Redis in Dec 2024.

```ts
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: 'mbs',
})
const { success } = await ratelimit.limit(`${sessionId}:${ip}`)
```

---

## Drizzle ORM + Neon

**Could not verify against a live source** (orm.drizzle.team blocked, npmjs blocked). Based on stable API:

- `drizzle-orm` line: **0.3x / 0.4x** (verify), `drizzle-kit` line: same ballpark. Re-check both.
- `pgTable` with type helpers still current:

```ts
import { pgTable, text, jsonb, timestamp, pgEnum, uuid } from 'drizzle-orm/pg-core'

export const role = pgEnum('role', ['user', 'assistant', 'system'])

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: role('role').notNull(),
  content: text('content').notNull(),
  tags: text('tags').array(),                                // text[]
  meta: jsonb('meta').$type<Record<string, unknown>>(),      // jsonb
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),                                              // timestamptz
})
```

- **`push` vs `migrate` for a single-dev v1:** use `drizzle-kit push` during the iterate-fast phase to sync schema → DB without migration files. The moment you have real data in prod, switch to `drizzle-kit generate` + `drizzle-kit migrate` so changes are versioned and reviewable. Don't ship `push` to production. This guidance is long-standing and unlikely to have flipped; re-check the Kit docs before build.

**Action item:** verify versions and that no 2026 release has changed the array/jsonb helpers (unlikely but cheap).

---

## What changes for our design doc / build plan

1. **Rename `middleware.ts` → `proxy.ts` from day one.** Update the design doc accordingly. We cannot use Edge inside Proxy, but Node is what we wanted anyway for iron-session (AES + Node crypto).
2. **Don't enable `cacheComponents`** for v1. Remove any mention of `experimental_ppr`, `dynamicIO`, or fetch-based `revalidate`. Our routes will stay on the "classic" dynamic model.
3. **Set `runtime = 'nodejs'` explicitly on `/api/chat`** for clarity, even though it's the default. Required for iron-session, Upstash (REST works fine on Edge, but Node gives us SDK flexibility), and wiki filesystem reads.
4. **Wiki bundling:** `outputFileTracingIncludes: { '/api/chat': ['./wiki/**/*.md'] }`. If `wiki/` is a submodule *outside* the Next app directory, also set `outputFileTracingRoot` and use a relative path from that root.
5. **Async APIs everywhere:** all `cookies()`, `headers()`, `params`, `searchParams` calls must be `await`-ed. Update any code snippets in the design doc.
6. **Cron:** `vercel.json` `crons` entry is a GET to `/api/warm`. Gate the handler on `User-Agent: vercel-cron/1.0` + a `CRON_SECRET` bearer header. Confirm Hobby plan cron limits allow the schedule you want.
7. **Package versions to pin before first build:** `iron-session`, `@upstash/ratelimit`, `@upstash/redis`, `drizzle-orm`, `drizzle-kit`. I could not verify these in this session; run `npm view` on each and record in the build plan.
8. **Turbopack is the default** — simplify our `package.json` scripts and drop any `--turbopack` flags from the design doc. If we had a webpack customization planned, it must be Turbopack-compatible or we pass `--webpack` explicitly.
9. **`revalidateTag('x', 'max')`** — if any warming logic invalidates cache tags, add the required second arg.
10. **Marketplace Upstash** requires no token wiring in code — the Redis integration injects env vars directly.

## Open items / flags

- iron-session current version + any API drift in 2026.
- `@upstash/ratelimit` current version + any new composite-key API.
- `drizzle-orm` + `drizzle-kit` current versions; any 2026 changes to array or `timestamp({ withTimezone })` helpers.
- Vercel Cron limits on Hobby vs Pro.

All four are low-risk to re-verify quickly once Context7 or npmjs is reachable in the build session.
