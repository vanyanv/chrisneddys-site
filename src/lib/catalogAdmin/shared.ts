/**
 * What the admin write modules share: the database default, slugs, and
 * the next grid position.
 *
 * Part of `@/lib/catalogAdmin` (see `src/lib/catalogAdmin.ts`), which
 * re-exports the public names; import from there, not from here.
 */
import { desc, ne } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { products } from "@/db/schema";

/** `db ?? getDb()` — lets a function join a caller's transaction (pass `tx`)
 * while still working standalone (pass nothing). Same pattern as
 * `src/lib/orders.ts`'s `resolveDb`. */
export async function resolveDb(db: Db | undefined): Promise<Db> {
  return db ?? (await getDb());
}

export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "product";
}

/** Appends `-2`, `-3`, … to `base` until it is unique among other products' slugs. */
export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const db = await getDb();
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(excludeId ? ne(products.id, excludeId) : undefined);
  const taken = new Set(rows.map((r) => r.slug));

  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Appends `-copy`, then `-copy-2`, `-copy-3`, … to `baseSlug` until unique. */
export async function uniqueCopySlug(baseSlug: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select({ slug: products.slug }).from(products);
  const taken = new Set(rows.map((r) => r.slug));

  const base = `${baseSlug}-copy`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** One past the highest existing `position`, i.e. where a new product (or a
 * duplicate) belongs so it lands at the end of the rack. */
export async function nextPosition(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ position: products.position })
    .from(products)
    .orderBy(desc(products.position))
    .limit(1);
  return (row?.position ?? -1) + 1;
}
