// lib/db/schema.ts — Metis v1 schema (replaces template chat schema)
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const messageRole = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

// Auth.js adapter scaffolding — minimal. We use JWT strategy so DB sessions
// are not required, but this table may be referenced by downstream queries.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
});

export const thread = pgTable(
  "thread",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: text("session_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sessionIdx: index("thread_session_idx").on(t.sessionId, t.updatedAt),
  })
);

export const message = pgTable(
  "message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => thread.id, { onDelete: "cascade" }),
    // Denormalized for fast session-scoped queries without joining thread.
    sessionId: text("session_id").notNull(),
    role: messageRole("role").notNull(),
    parts: jsonb("parts").notNull(), // UIMessage[] parts
    modelId: text("model_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    threadIdx: index("message_thread_idx").on(t.threadId, t.createdAt),
    sessionIdx: index("message_session_idx").on(t.sessionId, t.createdAt),
  })
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" })
      .unique(),
    sessionId: text("session_id").notNull(),
    rating: smallint("rating").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    ratingCheck: check("feedback_rating_range", sql`rating in (-1, 0, 1)`),
    sessionIdx: index("feedback_session_idx").on(t.sessionId, t.createdAt),
  })
);

export const retrievalTrace = pgTable(
  "retrieval_trace",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" })
      .unique(),
    sessionId: text("session_id").notNull(),
    // [{name, args, ok, reason?}]
    toolsCalled: jsonb("tools_called").notNull(),
    pagesRead: text("pages_read")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    citedPages: text("cited_pages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    hallucinatedCitations: text("hallucinated_citations")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    durationMs: integer("duration_ms"),
    tokenCountIn: integer("token_count_in"),
    tokenCountOut: integer("token_count_out"),
    // [{model, in, out, latency}]
    modelCalls: jsonb("model_calls"),
    stepCount: integer("step_count"),
    hitStepCap: boolean("hit_step_cap").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    sessionIdx: index("trace_session_idx").on(t.sessionId, t.createdAt),
  })
);
