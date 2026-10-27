import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run on in-memory PGlite only. `src/db/client.ts` picks Neon whenever
// DATABASE_URL is set, so a shell that has it (a deploy env pulled locally, a
// cloud session) would otherwise run every write-heavy test against that
// database. On 2026-10-26 that happened once and wrote test products, orders
// and settings into a real Neon database. Clear it before any worker starts.
delete process.env.DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // @electric-sql/pglite boots a WASM Postgres; that cold start alone can
    // take several seconds, well past Vitest's 5s default for a single test
    // or hook.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: { DATABASE_URL: "" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
