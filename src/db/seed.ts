/**
 * Seeds the catalogue from `src/data/merch.ts` — today, exactly the Foam
 * Trucker. `merch.ts` is still the single place that copy is edited; this
 * module only carries it into the database.
 *
 * Idempotent: every write is an upsert keyed on the same natural key a second
 * run would produce (`slug`, `(product_id, view_id)`, `sku`,
 * `(variant_id, number)`), so running `seedCatalogue` twice leaves exactly
 * the same rows the first run did — no duplicates, no drift.
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

  const [row] = await db
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
    .onConflictDoUpdate({
      target: products.slug,
      set: {
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
        capColor: product.capColor ?? null,
        details: product.details ?? null,
        fit: product.fit ?? null,
        limitedCopy: product.limitedCopy ?? null,
        why: product.why ?? null,
        authenticityCopy: product.authenticityCopy ?? null,
        authenticityFacts: product.authenticityFacts ?? null,
        photoDir: product.photoDir ?? null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: products.id });

  if (!row) throw new Error("upsert of the product row returned nothing");
  const productId = row.id;

  const rows = imageRows(product);
  for (const [position, image] of rows.entries()) {
    await db
      .insert(productImages)
      .values({ productId, position, ...image })
      .onConflictDoUpdate({
        target: [productImages.productId, productImages.viewId],
        set: {
          position,
          label: image.label,
          alt: image.alt,
          src: image.src,
          width: image.width,
          height: image.height,
          kind: image.kind,
          updatedAt: new Date(),
        },
      });
  }

  const [variantRow] = await db
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
    .onConflictDoUpdate({
      target: variants.sku,
      set: {
        productId,
        label: "One size",
        inventoryQuantity: EDITION_SIZE,
        editionSize: EDITION_SIZE,
        updatedAt: new Date(),
      },
    })
    .returning({ id: variants.id });

  if (!variantRow) throw new Error("upsert of the variant row returned nothing");
  const variantId = variantRow.id;

  const existing = await db
    .select({ number: editions.number })
    .from(editions)
    .where(eq(editions.variantId, variantId));
  const existingNumbers = new Set(existing.map((e) => e.number));

  for (let number = 1; number <= EDITION_SIZE; number++) {
    if (existingNumbers.has(number)) continue;
    await db.insert(editions).values({ variantId, number, status: "available" });
  }
}
