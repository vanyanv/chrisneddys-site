#!/usr/bin/env node
/**
 * Deploy-time database bootstrap: migrate, then seed the catalogue.
 *
 * Chained into `prebuild`, after the existing map-base build, so it runs on
 * every `pnpm build` — including Vercel's. With no `DATABASE_URL` (CI, or a
 * preview deploy that has not been given one) it does nothing but print why:
 * the build then falls back to the in-repo catalogue (`src/lib/catalog.ts`),
 * so it still succeeds with no network and no database.
 *
 * With `DATABASE_URL` set, it talks to Neon over HTTP — the same driver the
 * app uses at runtime — applies every migration in `drizzle/`, and upserts
 * the seed catalogue. Both are idempotent, so this is safe to run on every
 * deploy, not just the first.
 *
 *   pnpm db:migrate   # this script's migrate step alone
 *   pnpm db:seed      # this script's seed step alone
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "../src/db/schema.ts";
import { seedCatalogue } from "../src/db/seed.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = join(root, "drizzle");

const step = process.argv[2] ?? "all"; // "all" | "migrate" | "seed"

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL not set — skipping migrations and seed");
  process.exit(0);
}

const sql = neon(url);
const db = drizzle(sql, { schema });

if (step === "all" || step === "migrate") {
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder });
}

if (step === "all" || step === "seed") {
  console.log("Seeding catalogue…");
  await seedCatalogue(db);
}

console.log("Database ready.");
