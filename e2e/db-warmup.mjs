#!/usr/bin/env node
/**
 * Runs once, single-process, before `next build` in playwright.config.ts's
 * `webServer.command`.
 *
 * `src/db/client.ts`'s file-persisted PGlite path (`DATABASE_URL` unset, not
 * a Vitest run) migrates and seeds itself lazily, the first time something
 * calls `getDb()`. Left alone, `next build`'s static-generation step is the
 * first caller — and it runs several pages' generation in parallel worker
 * processes, each importing `src/db/client.ts` fresh and each racing to
 * `mkdir`/migrate/seed the *same* data directory at once. That's corrupted
 * the PGlite data directory outright in testing here (Postgres error
 * "unexpected data beyond EOF in block ... of relation", surfaced as `next
 * build` failing to prerender `/returns`).
 *
 * Doing the migrate+seed once, here, before `next build` starts, means every
 * worker's later `getDb()` call finds the schema and seed already in place
 * and just opens the existing database — no concurrent first-write race.
 *
 * Honours `PGLITE_DATA_DIR` the same way `src/db/client.ts` does (it just
 * calls `getDb()`, which reads that var itself) — playwright.config.ts sets
 * it to `.pglite/e2e`, kept separate from the developer's own `.pglite/dev`.
 */
import { getDb } from "../src/db/client.ts";

await getDb();
