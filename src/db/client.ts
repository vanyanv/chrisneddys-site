/**
 * Picks the Postgres driver for this process and hands back a Drizzle client.
 *
 * - `DATABASE_URL` set → Neon over HTTP (`@neondatabase/serverless` +
 *   `drizzle-orm/neon-http`). This is production and any preview deploy that
 *   has the variable configured. Migrations and the seed run once at deploy
 *   time (`scripts/db-prepare.mjs`, chained into `prebuild`) — this module
 *   never migrates or seeds the Neon path itself.
 * - `DATABASE_URL` unset, running under Vitest → an in-memory PGlite
 *   instance. Tests own their own migrate/seed calls (see
 *   `src/lib/catalog.test.ts`), so nothing is bootstrapped here either.
 * - `DATABASE_URL` unset, everything else (i.e. `pnpm dev`) → a PGlite
 *   instance file-persisted at `.pglite/` (gitignored), migrated and seeded
 *   once per process so a fresh clone works with zero setup. Both steps are
 *   idempotent, so restarting `next dev` never duplicates anything.
 *
 * `src/lib/catalog.ts` decides on its own, separately, when to skip the
 * database entirely and read `src/data/merch.ts` instead (a production build
 * with no `DATABASE_URL` — CI, or a preview without the variable set).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema.ts";
import { seedCatalogue } from "./seed.ts";

type Schema = typeof schema;
/**
 * The driver-agnostic type the rest of the app (and `seedCatalogue`) codes
 * against — both `NeonHttpDatabase<Schema>` and `PgliteDatabase<Schema>` are
 * `PgDatabase<TheirOwnQueryResultKind, Schema>`, so this is the common base
 * rather than a union: chained query-builder calls (`.returning()` and
 * friends) type-check the same regardless of which driver created the
 * client.
 */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsFolder = join(root, "drizzle");
const devDataDir = join(root, ".pglite", "dev");

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

let dbPromise: Promise<Db> | null = null;

/** Creates (once per process) and returns the Drizzle client for this environment. */
export function getDb(): Promise<Db> {
  if (!dbPromise) dbPromise = createDb();
  return dbPromise;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  }

  if (isTestEnv()) {
    const client = new PGlite();
    return drizzlePglite(client, { schema });
  }

  // pnpm dev, no DATABASE_URL: a durable local database, bootstrapped once.
  // PGlite's node filesystem backend does `mkdir` (not `mkdir -p`) on its
  // data directory, so `.pglite/` itself has to exist first.
  mkdirSync(devDataDir, { recursive: true });
  const client = new PGlite(devDataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  await seedCatalogue(db);
  return db;
}
