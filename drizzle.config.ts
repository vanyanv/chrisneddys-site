import { defineConfig } from "drizzle-kit";

/**
 * Used only by `drizzle-kit generate` (reads the schema, writes SQL into
 * `drizzle/`) and `drizzle-kit studio`/`migrate` against a real Postgres.
 * `generate` does not need a reachable database, but the config still
 * requires `dbCredentials` to be present — a placeholder is fine for that,
 * and nothing here is a secret.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/placeholder",
  },
});
