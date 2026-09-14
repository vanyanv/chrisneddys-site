/**
 * Seeds the catalogue from `src/data/merch.ts` — today, exactly the Foam
 * Trucker. `merch.ts` is still the single place that copy is edited; this
 * module only carries it into the database.
 *
 * Idempotent, and insert-only: every write targets the same natural key a
 * second run would produce (`slug`, `(product_id, view_id)`, `sku`,
 * `(variant_id, number)`) with `onConflictDoNothing`, so running
 * `seedCatalogue` twice leaves exactly the same rows the first run did — no
 * duplicates, no drift — but a *third* run (the next deploy) also leaves
 * alone whatever an owner has since changed through /admin. The product is
 * created once, from `merch.ts`, and never touched again by this module;
 * price, status, copy, edition size and image alt text are /admin's to own
 * from then on.
 *
 * Deliberately imported by relative path, not the `@/` alias: this file is
 * also run directly by Node (`scripts/db-prepare.mjs`, via
 * `--experimental-strip-types`), which does not resolve `tsconfig.json`
 * path aliases.
 */
import { eq } from "drizzle-orm";
import { merch, type MerchProduct, type MerchView } from "../data/merch.ts";
import { editions, productImages, products, storeSettings, variants } from "./schema.ts";
import type { Db } from "./client.ts";

const FOAM_TRUCKER_SLUG = "foam-trucker-blue";
const FOAM_TRUCKER_SKU = "CNE-FOAM-TRUCKER-BLUE";
const EDITION_SIZE = 50;

function findFoamTrucker(): MerchProduct {
  const product = merch.find((p) => p.slug === FOAM_TRUCKER_SLUG);
  if (!product) throw new Error(`expected ${FOAM_TRUCKER_SLUG} in the merch catalogue`);
  return product;
}

type ImageRow = {
  viewId: string;
  label: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  kind: "view" | "certificate" | "sticker";
};

function imageRows(product: MerchProduct): ImageRow[] {
  const rows: ImageRow[] = [];

  product.views.forEach((view: MerchView) => {
    if (!view.photo) return;
    rows.push({
      viewId: view.id,
      label: view.label,
      alt: view.caption,
      src: view.photo.src,
      width: view.photo.width,
      height: view.photo.height,
      kind: "view",
    });
  });

  if (product.authenticity) {
    const { certificate, sticker } = product.authenticity;
    rows.push({
      viewId: "certificate",
      label: "CERTIFICATE",
      alt: certificate.alt,
      src: certificate.src,
      width: certificate.width,
      height: certificate.height,
      kind: "certificate",
    });
    rows.push({
      viewId: "sticker",
      label: "STICKER",
      alt: sticker.alt,
      src: sticker.src,
      width: sticker.width,
      height: sticker.height,
      kind: "sticker",
    });
  }

  return rows;
}

/**
 * Inserts the single `store_settings` row the first time this runs.
 * Deliberately `onConflictDoNothing` rather than an upsert — an owner's
 * edits through /admin should survive every later redeploy's reseed.
 */
async function seedStoreSettings(db: Db): Promise<void> {
  await db
    .insert(storeSettings)
    .values({
      id: "default",
      storeName: "Chris N Eddy's",
      supportEmail: "chris@chrisneddys.com",
    })
    .onConflictDoNothing({ target: storeSettings.id });
}

/** Upserts the in-repo catalogue into the database. Safe to call any number of times. */
export async function seedCatalogue(db: Db): Promise<void> {
  await seedStoreSettings(db);

  const product = findFoamTrucker();

  // Insert-only: create the product row the first time this runs, then
  // never touch it again — /admin owns price/status/copy/etc. from then on,
  // and a redeploy must not revert an owner's edits.
  const position = merch.findIndex((p) => p.slug === product.slug);

  const [insertedProduct] = await db
    .insert(products)
    .values({
      slug: product.slug,
      name: product.name,
      displayName1: product.displayName[0],
      displayName2: product.displayName[1],
      eyebrow: product.eyebrow,
      description: product.description,
      metaDescription: product.metaDescription,
      limitedNote: product.limitedNote,
      priceCents: Math.round(product.price * 100),
      oneSize: product.oneSize,
      status: "published",
      position: position === -1 ? 0 : position,
      capColor: product.capColor ?? null,
      details: product.details ?? null,
      fit: product.fit ?? null,
      limitedCopy: product.limitedCopy ?? null,
      why: product.why ?? null,
      authenticityCopy: product.authenticityCopy ?? null,
      authenticityFacts: product.authenticityFacts ?? null,
      photoDir: product.photoDir ?? null,
      publishedAt: new Date(),
    })
    .onConflictDoNothing({ target: products.slug })
    .returning({ id: products.id });

  const productId =
    insertedProduct?.id ??
    (
      await db.query.products.findFirst({
        where: eq(products.slug, product.slug),
        columns: { id: true },
      })
    )?.id;
  if (!productId) throw new Error("could not find or create the product row");

  // Insert-only, same reasoning: an image an owner has replaced or re-typed
  // the alt text for through /admin must survive every later reseed.
  const rows = imageRows(product);
  for (const [position, image] of rows.entries()) {
    await db
      .insert(productImages)
      .values({ productId, position, ...image })
      .onConflictDoNothing({ target: [productImages.productId, productImages.viewId] });
  }

  const [insertedVariant] = await db
    .insert(variants)
    .values({
      productId,
      sku: FOAM_TRUCKER_SKU,
      label: "One size",
      priceCents: null,
      inventoryQuantity: EDITION_SIZE,
      editionSize: EDITION_SIZE,
      position: 0,
    })
    .onConflictDoNothing({ target: variants.sku })
    .returning({ id: variants.id });

  const variantId =
    insertedVariant?.id ??
    (
      await db.query.variants.findFirst({
        where: eq(variants.sku, FOAM_TRUCKER_SKU),
        columns: { id: true },
      })
    )?.id;
  if (!variantId) throw new Error("could not find or create the variant row");

  // Insert-only per number: an edition an owner has since sold, reserved,
  // or otherwise changed the status of must not be reset to "available" by
  // a later reseed — only numbers that don't exist yet are created.
  for (let number = 1; number <= EDITION_SIZE; number++) {
    await db
      .insert(editions)
      .values({ variantId, number, status: "available" })
      .onConflictDoNothing({ target: [editions.variantId, editions.number] });
  }
}
