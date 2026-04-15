// scripts/push-schema.mjs — manually execute the DDL for the Metis v1 schema.
// Run with: node scripts/push-schema.mjs
// This bypasses the interactive drizzle-kit push prompt.

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.POSTGRES_URL ?? "";
if (!url) {
  console.error("[push-schema] POSTGRES_URL is not set. Aborting.");
  process.exit(1);
}

const isProdLike =
  !url.includes("localhost") &&
  !url.includes("127.0.0.1") &&
  !url.includes("neon.tech/dev") &&
  process.env.NODE_ENV === "production";

if (isProdLike && process.env.CONFIRM_DROP_PROD !== "yes") {
  console.error("[push-schema] Refusing to run against production-like DB.");
  console.error(`  POSTGRES_URL host: ${new URL(url).host}`);
  console.error(
    "  To override, set CONFIRM_DROP_PROD=yes (THIS DESTROYS DATA)."
  );
  process.exit(1);
}

console.log(`[push-schema] target DB host: ${new URL(url).host}`);
console.log(
  "[push-schema] this script DROPS legacy tables CASCADE — destructive."
);

const sql = postgres(url);

async function main() {
  console.log("Dropping old tables...");

  // Drop in dependency order.
  await sql`DROP TABLE IF EXISTS "Suggestion" CASCADE`;
  await sql`DROP TABLE IF EXISTS "Vote_v2" CASCADE`;
  await sql`DROP TABLE IF EXISTS "Stream" CASCADE`;
  await sql`DROP TABLE IF EXISTS "Document" CASCADE`;
  await sql`DROP TABLE IF EXISTS "Message_v2" CASCADE`;
  await sql`DROP TABLE IF EXISTS "Chat" CASCADE`;
  await sql`DROP TABLE IF EXISTS "User" CASCADE`;

  console.log("Creating enum + new tables...");

  await sql`
    DO $$ BEGIN
      CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      "id"    TEXT PRIMARY KEY,
      "name"  TEXT,
      "email" TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "thread" (
      "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "session_id" TEXT NOT NULL,
      "title"      TEXT,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "thread_session_idx" ON "thread" ("session_id", "updated_at")
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "message" (
      "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "thread_id"  UUID NOT NULL REFERENCES "thread"("id") ON DELETE CASCADE,
      "session_id" TEXT NOT NULL,
      "role"       message_role NOT NULL,
      "parts"      JSONB NOT NULL,
      "model_id"   TEXT,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "message_thread_idx" ON "message" ("thread_id", "created_at")
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "message_session_idx" ON "message" ("session_id", "created_at")
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "feedback" (
      "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "message_id" UUID NOT NULL UNIQUE REFERENCES "message"("id") ON DELETE CASCADE,
      "session_id" TEXT NOT NULL,
      "rating"     SMALLINT NOT NULL,
      "note"       TEXT,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "feedback_rating_range" CHECK (rating IN (-1, 0, 1))
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "feedback_session_idx" ON "feedback" ("session_id", "created_at")
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "retrieval_trace" (
      "id"                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      "message_id"             UUID NOT NULL UNIQUE REFERENCES "message"("id") ON DELETE CASCADE,
      "session_id"             TEXT NOT NULL,
      "tools_called"           JSONB NOT NULL,
      "pages_read"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "cited_pages"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "hallucinated_citations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "duration_ms"            INTEGER,
      "token_count_in"         INTEGER,
      "token_count_out"        INTEGER,
      "model_calls"            JSONB,
      "step_count"             INTEGER,
      "hit_step_cap"           BOOLEAN NOT NULL DEFAULT FALSE,
      "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "trace_session_idx" ON "retrieval_trace" ("session_id", "created_at")
  `;

  console.log("Schema applied successfully.");
  await sql.end();
}

main().catch((err) => {
  console.error("push-schema failed:", err);
  process.exit(1);
});
