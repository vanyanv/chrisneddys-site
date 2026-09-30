/**
 * A product's run: untracked, a count, or a numbered edition, and how
 * many of it are for sale online.
 *
 * Part of `@/lib/catalogAdmin` (see `src/lib/catalogAdmin.ts`), which
 * re-exports the public names; import from there, not from here.
 */
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { editions, products, variants } from "@/db/schema";
import { resolveDb } from "./shared";

export type InventoryMode = "untracked" | "quantity" | "edition";

export type SetInventoryResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Thrown when an edition run's size would change after any number in it has
 * sold — issue #36's "Wiring The Rack" analysis, phase 3: "the count locks
 * the moment number one sells" (the `n-run` annotation), because by then
 * that count is printed on a certificate in somebody's hands. Once
 * `soldCount` is above zero, `setInventory("edition", …)` refuses *any*
 * different size — growing the run is refused exactly like shrinking it,
 * not just a shrink below the highest sold number (the pre-phase-3 rule).
 * `setInventory` is the only caller today; it catches this and reports
 * `.message` through its ordinary `{ ok: false, error }` result, but the
 * class is exported so the lock itself — not just that one call site's
 * translation of it — is directly testable.
 */
export class EditionSizeLockedError extends Error {
  constructor(public readonly soldCount: number) {
    super(
      `This run is locked — ${soldCount} number${soldCount === 1 ? " has" : "s have"} already ` +
        "sold. The edition size can't change now.",
    );
    this.name = "EditionSizeLockedError";
  }
}

/** Throws `EditionSizeLockedError` if `variant` already has any `sold`
 * edition and `nextSize` isn't the size it's already at — a no-op save (the
 * same size resubmitted) never trips the lock. A variant with nothing sold
 * yet, or with no variant at all (a run that's never existed), is always
 * unlocked. */
function assertEditionSizeUnlocked(
  variant: { editionSize: number | null; editions: { status: string }[] } | undefined,
  nextSize: number,
): void {
  if (!variant || nextSize === variant.editionSize) return;
  const soldCount = variant.editions.filter((e) => e.status === "sold").length;
  if (soldCount > 0) throw new EditionSizeLockedError(soldCount);
}

/**
 * Sets a product's inventory mode.
 *
 * - `untracked`: clears both `inventory_quantity` and `edition_size` on the
 *   variant (creating a bare one if none exists yet).
 * - `quantity`: stores a plain count, clears `edition_size`.
 * - `edition`: creates the variant if none exists (sku from the slug,
 *   upper-cased; label "One size"), then makes the run exactly `1..n` —
 *   creating the numbers that don't exist yet and deleting any above `n`.
 *   Never deletes a `sold` or `reserved` edition: changing `n` at all once
 *   anything has sold is refused outright by `assertEditionSizeUnlocked`
 *   (not just a shrink below the highest sold number), and a shrink past a
 *   number held by an open checkout is refused until that hold lapses.
 */
export async function setInventory(
  id: string,
  mode: InventoryMode,
  n?: number,
  dbOverride?: Db,
): Promise<SetInventoryResult> {
  const db = await resolveDb(dbOverride);
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { variants: { with: { editions: true } } },
  });
  if (!product) return { ok: false, error: "Product not found." };

  let variant = product.variants[0];

  if (mode === "edition") {
    const size = n ?? 0;
    if (!Number.isInteger(size) || size < 1) {
      return { ok: false, error: "Edition size must be a positive whole number." };
    }

    try {
      assertEditionSizeUnlocked(variant, size);
    } catch (err) {
      if (err instanceof EditionSizeLockedError) return { ok: false, error: err.message };
      throw err;
    }

    if (!variant) {
      const [row] = await db
        .insert(variants)
        .values({
          productId: id,
          sku: product.slug.toUpperCase(),
          label: "One size",
          inventoryQuantity: size,
          editionSize: size,
        })
        .returning();
      if (!row) throw new Error("insert of the variant returned nothing");
      variant = { ...row, editions: [] };
    } else {
      await db
        .update(variants)
        .set({ editionSize: size, inventoryQuantity: size, updatedAt: new Date() })
        .where(eq(variants.id, variant.id));
    }

    // Shrinking has to remove the numbers that fall off the end, or the run
    // keeps rows it no longer claims to have: take 50 down to 20 and the
    // board reads "50 of 20 left", counting fifty surviving editions against
    // an `editionSize` of 20. Nothing above `size` can be `sold` — the lock
    // above already refused any change in that case — but a number can be
    // `reserved` by a checkout that's open right now, and deleting that row
    // would strand a buyer mid-payment holding a number the run no longer
    // has. So refuse the shrink while such a hold is live, and say which
    // number it is; holds lapse on their own, and the save works after.
    if (variant.editions.some((e) => e.number > size && e.status === "reserved")) {
      const held = variant.editions
        .filter((e) => e.number > size && e.status === "reserved")
        .map((e) => e.number)
        .sort((a, b) => a - b);
      return {
        ok: false,
        error:
          `Number ${held[0]} is on hold in an open checkout right now, so the run ` +
          `can't shrink to ${size} yet. Try again once the hold lapses.`,
      };
    }
    await db
      .delete(editions)
      .where(and(eq(editions.variantId, variant.id), gt(editions.number, size)));

    const existingNumbers = new Set(variant.editions.map((e) => e.number));
    for (let number = 1; number <= size; number++) {
      if (existingNumbers.has(number)) continue;
      await db.insert(editions).values({ variantId: variant.id, number, status: "available" });
    }
    // `inventory_quantity` was set to `size` above; with numbers set aside
    // (or held) that's more than can actually be bought.
    await syncAvailableMirror(db, variant.id);

    return { ok: true, slug: product.slug };
  }

  if (mode === "quantity") {
    const quantity = n ?? 0;
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { ok: false, error: "Quantity must be zero or a positive whole number." };
    }

    if (!variant) {
      await db.insert(variants).values({
        productId: id,
        sku: product.slug.toUpperCase(),
        label: "One size",
        inventoryQuantity: quantity,
        editionSize: null,
      });
    } else {
      await db
        .update(variants)
        .set({ inventoryQuantity: quantity, editionSize: null, updatedAt: new Date() })
        .where(eq(variants.id, variant.id));
    }

    return { ok: true, slug: product.slug };
  }

  // untracked
  if (!variant) {
    await db.insert(variants).values({
      productId: id,
      sku: product.slug.toUpperCase(),
      label: "One size",
      inventoryQuantity: null,
      editionSize: null,
    });
  } else {
    await db
      .update(variants)
      .set({ inventoryQuantity: null, editionSize: null, updatedAt: new Date() })
      .where(eq(variants.id, variant.id));
  }

  return { ok: true, slug: product.slug };
}

/** `variants.inventory_quantity` for an edition product mirrors the count of
 * `available` numbers — the same rule `syncVariantAvailableMirror` in
 * `src/lib/orders.ts` applies after every reservation and payment. */
async function syncAvailableMirror(db: Db, variantId: string): Promise<void> {
  const rows = await db
    .select({ id: editions.id })
    .from(editions)
    .where(and(eq(editions.variantId, variantId), eq(editions.status, "available")));
  await db
    .update(variants)
    .set({ inventoryQuantity: rows.length, updatedAt: new Date() })
    .where(eq(variants.id, variantId));
}

/**
 * How many numbers of an edition run are for sale online — the "left to sell
 * online" field. The run keeps its size (a run of 50 is still "only 50
 * made"); numbers beyond `n` are `set_aside`, not deleted, so the shop reads
 * "20 of 50 left".
 *
 * Lowering the count sets aside the lowest-numbered available numbers first
 * (the ones that went out at the location first); raising it puts back the
 * highest-numbered set-aside ones first. Sold numbers and numbers held in an
 * open checkout are never touched, so `n` can't be more than what's
 * available plus what's set aside. A specific number can be moved either
 * way on the run page (`setEditionAside`).
 */
export async function setOnlineCount(
  id: string,
  n: number,
  dbOverride?: Db,
): Promise<SetInventoryResult> {
  const db = await resolveDb(dbOverride);
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { variants: { with: { editions: true } } },
  });
  if (!product) return { ok: false, error: "Product not found." };
  const variant = product.variants[0];
  if (!variant || variant.editionSize === null) {
    return { ok: false, error: "Only a numbered edition has numbers to set aside." };
  }
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, error: "Left to sell online must be zero or a positive whole number." };
  }

  const available = variant.editions
    .filter((e) => e.status === "available")
    .map((e) => e.number)
    .sort((a, b) => a - b);
  const aside = variant.editions
    .filter((e) => e.status === "set_aside")
    .map((e) => e.number)
    .sort((a, b) => b - a);
  const max = available.length + aside.length;
  if (n > max) {
    return {
      ok: false,
      error: `Only ${max} of the ${variant.editionSize} can go online — the rest are sold or held in an open checkout.`,
    };
  }

  if (n < available.length) {
    const toSetAside = available.slice(0, available.length - n);
    await db
      .update(editions)
      .set({ status: "set_aside", reservedUntil: null, orderId: null, updatedAt: new Date() })
      .where(and(eq(editions.variantId, variant.id), inArray(editions.number, toSetAside)));
  } else if (n > available.length) {
    const toPutBack = aside.slice(0, n - available.length);
    await db
      .update(editions)
      .set({ status: "available", updatedAt: new Date() })
      .where(and(eq(editions.variantId, variant.id), inArray(editions.number, toPutBack)));
  }
  await syncAvailableMirror(db, variant.id);
  return { ok: true, slug: product.slug };
}

/**
 * Moves one specific number between the online shop and set aside — the run
 * page's per-number control, for when it matters which certificate numbers
 * went out at the location. Only `available` and `set_aside` numbers move;
 * a sold number or one held in an open checkout is refused.
 */
export async function setEditionAside(
  productId: string,
  number: number,
  aside: boolean,
): Promise<SetInventoryResult> {
  const db = await getDb();
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { variants: { with: { editions: true } } },
  });
  if (!product) return { ok: false, error: "Product not found." };
  const variant = product.variants[0];
  const edition = variant?.editions.find((e) => e.number === number);
  if (!variant || !edition) return { ok: false, error: `There's no number ${number} in this run.` };

  const from = aside ? "available" : "set_aside";
  if (edition.status !== from) {
    return {
      ok: false,
      error:
        edition.status === "sold"
          ? `Number ${number} has already sold.`
          : edition.status === "reserved"
            ? `Number ${number} is in an open checkout right now.`
            : aside
              ? `Number ${number} is already set aside.`
              : `Number ${number} is already for sale online.`,
    };
  }

  await db
    .update(editions)
    .set(
      aside
        ? { status: "set_aside", reservedUntil: null, orderId: null, updatedAt: new Date() }
        : { status: "available", updatedAt: new Date() },
    )
    .where(eq(editions.id, edition.id));
  await syncAvailableMirror(db, variant.id);
  return { ok: true, slug: product.slug };
}
