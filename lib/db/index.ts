import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Single connection pool shared across server modules.
// postgres-js handles connection pooling internally.
const client = postgres(process.env.POSTGRES_URL ?? "");

export const db = drizzle(client);
