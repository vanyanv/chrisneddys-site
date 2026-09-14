/**
 * Picks the Postgres driver for this process and hands back a Drizzle client.
 *
 * - `DATABASE_URL` set → Neon over WebSockets (`@neondatabase/serverless`
 *   `Pool` + `drizzle-orm/neon-serverless`). This is production and any
 *   preview deploy that has the variable configured. Migrations and the seed
 *   run once at deploy time (`scripts/db-prepare.mjs`, chained into
 *   `prebuild`) — this module never migrates or seeds the Neon path itself.
 *
 *   This is deliberately *not* `drizzle-orm/neon-http`: every order write in
 *   `src/lib/orders.ts` (`createPendingOrder`, `markPaid`, `releaseOrder`) is
 *   wrapped in `db.transaction(...)` for the row locking (`SELECT ... FOR
 *   UPDATE [SKIP LOCKED]`) that keeps two concurrent checkouts from
 *   double-selling the same edition number, and neon-http's session throws
 *   "No transactions support in neon-http driver" the instant `.transaction`
 *   is called (`drizzle-orm/neon-http/session.js`) — every one of those calls
 *   would be fatal in production. `Pool` from `@neondatabase/serverless`
 *   speaks the Postgres wire protocol over a WebSocket instead of one HTTP
 *   request per query, so it supports real multi-statement transactions the
 *   same way `pg` or PGlite do.
 *
 *   `Pool`'s WebSocket needs a `WebSocket` constructor: on Node.js 21 and
 *   earlier there isn't a global one, so `neonConfig.webSocketConstructor`
 *   has to be set (typically to the `ws` package). Node 22 (this project's
 *   minimum, see `engines` in `package.json`) ships a global `WebSocket`
 *   (backed by `undici`), and `@neondatabase/serverless`'s `Pool` already
 *   falls back to it when `webSocketConstructor` is left unset — verified
 *   against the installed `@neondatabase/serverless@1.1.0` (its browser
 *   WebSocket-connect path only reaches for `neonConfig.webSocketConstructor`
 *   if one was configured, else does `new WebSocket(url)` directly). So
 *   nothing is set here, and no `ws` dependency is needed.
 *
 *   The `Pool` itself is a module-level singleton (`neonPool`, below), created
 *   once per process the same way `dbPromise` already is — a serverless
 *   function instance that's reused across invocations (a Vercel Node.js
 *   function warm start, not Edge) keeps reusing the same pool and its
 *   already-open connection(s) instead of opening a fresh WebSocket per
 *   request.
 * - `DATABASE_URL` unset, running under Vitest → an in-memory PGlite
 *   instance. Tests own their own migrate/seed calls (see
 *   `src/lib/catalog.test.ts`), so nothing is bootstrapped here either.
 * - `DATABASE_URL` unset, everything else (i.e. `pnpm dev`) → a PGlite
 *   instance file-persisted at `.pglite/dev` (gitignored), migrated and
 *   seeded once per process so a fresh clone works with zero setup. Both
 *   steps are idempotent, so restarting `next dev` never duplicates anything.
 *   `PGLITE_DATA_DIR` overrides that path (relative to the repo root) — the
 *   e2e suite (`playwright.config.ts`) points it at `.pglite/e2e` so it never
 *   touches the developer's own `.pglite/dev` database.
 *
 * `src/lib/catalog.ts` decides on its own, separately, when to skip the
 * database entirely and read `src/data/merch.ts` instead (a production build
 * with no `DATABASE_URL` — CI, or a preview without the variable set).
 *
 * `scripts/db-prepare.mjs`, the one-shot deploy-time migrate/seed script,
 * deliberately keeps using `drizzle-orm/neon-http` rather than this module:
 * neither the migrator (`drizzle-orm/neon-http/migrator`, which runs each
 * migration statement individually — see its source) nor `seedCatalogue`
 * calls `db.transaction`, so http's lack of transaction support is a
 * non-issue there, and a short-lived script has no serverless-reuse
 * connection to manage — it can just fire HTTP requests and exit.
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
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
// Relative to the repo root; see the module comment above.
const devDataDir = join(root, process.env.PGLITE_DATA_DIR ?? join(".pglite", "dev"));

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * A plain module-scope `let` is NOT a true process-wide singleton under
 * `next dev`: the App Router compiles a module into a separate instance per
 * webpack "layer" (RSC, the SSR/page render, and the Server Actions
 * endpoint each get their own copy of this file), so a server action's
 * `getDb()` and a page's `getDb()` can end up creating two independent
 * `PGlite` instances pointed at the same `devDataDir`. PGlite can't have two
 * live instances on one data directory — this surfaced as writes made by a
 * Server Action (e.g. the Sheet's Save) silently not showing up when the
 * page re-rendered, and, once a third route triggered a third instance,
 * outright `RuntimeError: Aborted()` failures. `globalThis` is the one
 * object every layer's module instance shares within the same Node.js
 * process, so parking the promise there (Prisma's documented fix for the
 * same class of bug) makes `getDb()` an actual singleton in dev. Production
 * (`DATABASE_URL` set, one bundled function, no layer-split dev compiler)
 * and Vitest (in-memory PGlite, single process) were never affected, so
 * this only changes behaviour for `pnpm dev`.
 */
const globalForDb = globalThis as unknown as {
  __dbPromise?: Promise<Db> | null;
  __neonPool?: Pool | null;
};

/** Creates (once per process) and returns the Drizzle client for this environment. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__dbPromise) globalForDb.__dbPromise = createDb();
  return globalForDb.__dbPromise;
}

function getNeonPool(url: string): Pool {
  if (!globalForDb.__neonPool) {
    const pool = new Pool({ connectionString: url });
    // Surface idle-connection errors (e.g. Neon closing a stale socket)
    // instead of letting them become an unhandled 'error' event that
    // crashes the process.
    pool.on("error", (err: Error) => {
      console.error("neon Pool error", err);
    });
    globalForDb.__neonPool = pool;
  }
  return globalForDb.__neonPool;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url) {
    return drizzleNeon(getNeonPool(url), { schema });
  }

  if (isTestEnv()) {
    const client = new PGlite();
    return drizzlePglite(client, { schema });
  }

  // pnpm dev, no DATABASE_URL: a durable local database, bootstrapped once.
  // PGlite's node filesystem backend does `mkdir` (not `mkdir -p`) on its
  // data directory, so `.pglite/` (or PGLITE_DATA_DIR's parent) has to exist
  // first.
  mkdirSync(devDataDir, { recursive: true });
  const client = new PGlite(devDataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  await seedCatalogue(db);
  return db;
}
