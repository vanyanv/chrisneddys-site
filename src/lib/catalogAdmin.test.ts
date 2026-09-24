import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { editions, productImages, variants } from "@/db/schema";
import { listPublishedProducts } from "@/lib/catalog";
import {
  addImage,
  applyProductChanges,
  backfillDraftSeo,
  createDraft,
  duplicateProduct,
  EditionSizeLockedError,
  getProductForAdmin,
  listProductsForAdmin,
  moveImage,
  reorderImages,
  reorderProducts,
  removeImage,
  setInventory,
  setStatus,
  updateProduct,
  updateProductField,
} from "@/lib/catalogAdmin";
import { draftStoredSeo } from "@/lib/productSeo";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Gives a fresh draft a price and a run size — the two `setStatus` gates
 * (issue #36's decisions comment) that most tests here aren't themselves
 * about, so they can get past them without restating the same two calls. */
async function makePriceableAndSized(id: string, priceCents = 1000): Promise<void> {
  await updateProductField(id, "priceCents", priceCents);
  await setInventory(id, "quantity", 10);
}

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

describe("createDraft", () => {
  it("gives two drafts created from the same name different, unique slugs", async () => {
    const a = await createDraft("CNE Cyclops Tee");
    const b = await createDraft("CNE Cyclops Tee");
    expect(a.slug).not.toBe(b.slug);
    expect(a.slug).toBe("cne-cyclops-tee");
    expect(b.slug).toBe("cne-cyclops-tee-2");

    const admin = await getProductForAdmin(a.id);
    expect(admin?.status).toBe("draft");
  });
});

describe("updateProduct", () => {
  it("rejects a slug with characters outside a-z0-9-", async () => {
    const draft = await createDraft("Slug Test Product");
    const result = await updateProduct(draft.id, {
      name: "Slug Test Product",
      displayName1: "SLUG",
      displayName2: "TEST",
      eyebrow: "",
      slug: "Not A Valid Slug!",
      priceCents: 1000,
      perOrderLimit: 6,
      oneSize: true,
      description: "",
      metaDescription: "",
      limitedNote: "",
      details: [],
      fit: null,
      limitedCopy: null,
      why: null,
      authenticityCopy: null,
      authenticityFacts: [],
      metaTitle: null,
      metaKeywords: null,
      socialImageUrl: null,
      socialImageAlt: null,
    });
    expect(result.ok).toBe(false);
  });

  it("changing the slug returns both the old and new slug", async () => {
    const draft = await createDraft("Renamable Product");
    const result = await updateProduct(draft.id, {
      name: "Renamable Product",
      displayName1: "RENAMED",
      displayName2: "",
      eyebrow: "",
      slug: "renamed-product",
      priceCents: 2500,
      perOrderLimit: 4,
      oneSize: true,
      description: "d",
      metaDescription: "m",
      limitedNote: "l",
      details: ["one", "two"],
      fit: "fits",
      limitedCopy: null,
      why: null,
      authenticityCopy: null,
      authenticityFacts: [{ label: "A", value: "B" }],
      metaTitle: null,
      metaKeywords: null,
      socialImageUrl: null,
      socialImageAlt: null,
    });
    expect(result).toEqual({ ok: true, oldSlug: draft.slug, newSlug: "renamed-product" });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.slug).toBe("renamed-product");
    expect(admin?.details).toEqual(["one", "two"]);
    expect(admin?.authenticityFacts).toEqual([{ label: "A", value: "B" }]);
  });

  it("refuses a slug already used by a different product", async () => {
    const a = await createDraft("First Clash Product");
    const b = await createDraft("Second Clash Product");
    const result = await updateProduct(b.id, {
      name: "Second Clash Product",
      displayName1: "",
      displayName2: "",
      eyebrow: "",
      slug: a.slug,
      priceCents: 0,
      perOrderLimit: 6,
      oneSize: true,
      description: "",
      metaDescription: "",
      limitedNote: "",
      details: [],
      fit: null,
      limitedCopy: null,
      why: null,
      authenticityCopy: null,
      authenticityFacts: [],
      metaTitle: null,
      metaKeywords: null,
      socialImageUrl: null,
      socialImageAlt: null,
    });
    expect(result.ok).toBe(false);
  });
});

describe("setStatus", () => {
  it("stamps published_at only the first time a product is published", async () => {
    const draft = await createDraft("Status Test Product");
    const before = await getProductForAdmin(draft.id);
    expect(before?.publishedAt).toBeNull();

    await makePriceableAndSized(draft.id);
    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/1.webp",
      urlThumb: "https://example.com/1-thumb.webp",
      width: 720,
      height: 720,
    });

    const first = await setStatus(draft.id, "published");
    expect(first.ok).toBe(true);
    const afterFirstPublish = await getProductForAdmin(draft.id);
    expect(afterFirstPublish?.publishedAt).not.toBeNull();
    const firstPublishedAt = afterFirstPublish?.publishedAt;

    await setStatus(draft.id, "draft");
    await setStatus(draft.id, "published");
    const afterRepublish = await getProductForAdmin(draft.id);
    // Re-publishing keeps the original timestamp rather than treating every
    // publish as a new "first" one.
    expect(afterRepublish?.publishedAt?.getTime()).toBe(firstPublishedAt?.getTime());
  });

  it("refuses to publish a product with no photo, and takes no action", async () => {
    const draft = await createDraft("Photoless Product");
    await makePriceableAndSized(draft.id);

    const result = await setStatus(draft.id, "published");
    expect(result).toEqual({
      ok: false,
      error: "Add at least one photo before publishing.",
    });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.status).toBe("draft");
    expect(admin?.publishedAt).toBeNull();
  });

  it("allows publishing once a view photo exists", async () => {
    const draft = await createDraft("Photographed Product");
    await makePriceableAndSized(draft.id);
    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/1.webp",
      urlThumb: "https://example.com/1-thumb.webp",
      width: 720,
      height: 720,
    });

    const result = await setStatus(draft.id, "published");
    expect(result.ok).toBe(true);

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.status).toBe("published");
  });

  it("does not require a photo to move a product to draft or archived", async () => {
    const draft = await createDraft("Never Photographed Product");
    expect((await setStatus(draft.id, "draft")).ok).toBe(true);
    expect((await setStatus(draft.id, "archived")).ok).toBe(true);
  });

  // The unnamed-draft decision (issue #36's decisions comment): the second
  // hat is `[SECOND COLOURWAY]` with no name, price or run size, and the
  // catalogue must refuse to publish it — enforced here in the data layer,
  // not just by disabling a button — until all three (plus the existing
  // photo gate) are real.
  describe("the unnamed-draft gate", () => {
    async function addPhoto(id: string): Promise<void> {
      await addImage({
        productId: id,
        kind: "view",
        viewId: crypto.randomUUID(),
        label: "FRONT",
        alt: "front view alt text",
        urlFull: "https://example.com/gate.webp",
        urlThumb: "https://example.com/gate-thumb.webp",
        width: 720,
        height: 720,
      });
    }

    it('createDraft("") leaves the name genuinely blank, not a placeholder', async () => {
      const draft = await createDraft("");
      const admin = await getProductForAdmin(draft.id);
      expect(admin?.name).toBe("");
      expect(admin?.displayName1).toBe("");
      expect(admin?.displayName2).toBe("");
      // Still needs a real, unique slug — "draft" stands in for the slug
      // base only, never for the name a customer or the rack would see.
      expect(admin?.slug).toBeTruthy();
    });

    it("refuses to publish a nameless draft, even with a price, a run size and a photo", async () => {
      const draft = await createDraft("");
      await makePriceableAndSized(draft.id);
      await addPhoto(draft.id);

      const result = await setStatus(draft.id, "published");
      expect(result).toEqual({ ok: false, error: "Give it a name before publishing." });

      const admin = await getProductForAdmin(draft.id);
      expect(admin?.status).toBe("draft");
    });

    it("refuses to publish a named draft with no price", async () => {
      const draft = await createDraft("Second Colourway");
      await setInventory(draft.id, "quantity", 10);
      await addPhoto(draft.id);

      const result = await setStatus(draft.id, "published");
      expect(result).toEqual({ ok: false, error: "Set a price before publishing." });
    });

    it("refuses to publish a named, priced draft with no run size (still untracked)", async () => {
      const draft = await createDraft("Second Colourway");
      await updateProductField(draft.id, "priceCents", 4800);
      await addPhoto(draft.id);

      const result = await setStatus(draft.id, "published");
      expect(result).toEqual({ ok: false, error: "Set a run size before publishing." });
    });

    it("publishes once it has a name, a price, a run size and a photo", async () => {
      const draft = await createDraft("Second Colourway");
      await makePriceableAndSized(draft.id, 4800);
      await addPhoto(draft.id);

      const result = await setStatus(draft.id, "published");
      expect(result.ok).toBe(true);

      const admin = await getProductForAdmin(draft.id);
      expect(admin?.status).toBe("published");
    });

    it("a draft can still move to draft/archived with none of the four in place", async () => {
      const draft = await createDraft("");
      expect((await setStatus(draft.id, "draft")).ok).toBe(true);
      expect((await setStatus(draft.id, "archived")).ok).toBe(true);
    });
  });
});

describe("setInventory", () => {
  it("creates 50 edition rows, and re-running with 60 adds 10 more", async () => {
    const draft = await createDraft("Edition Test Product");

    const first = await setInventory(draft.id, "edition", 50);
    expect(first.ok).toBe(true);

    const db = await getDb();
    const variantRows = await db.select().from(variants).where(eq(variants.productId, draft.id));
    const variant = variantRows[0];
    if (!variant) throw new Error("expected a variant to have been created");

    const editionRows1 = await db.select().from(editions).where(eq(editions.variantId, variant.id));
    expect(editionRows1).toHaveLength(50);

    const second = await setInventory(draft.id, "edition", 60);
    expect(second.ok).toBe(true);

    const editionRows2 = await db.select().from(editions).where(eq(editions.variantId, variant.id));
    expect(editionRows2).toHaveLength(60);
  });

  it("refuses to shrink the edition below the highest sold number", async () => {
    const draft = await createDraft("Sold Edition Product");
    await setInventory(draft.id, "edition", 50);

    const db = await getDb();
    const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
    if (!variant) throw new Error("expected a variant");

    await db
      .update(editions)
      .set({ status: "sold" })
      .where(and(eq(editions.variantId, variant.id), eq(editions.number, 40)));

    const result = await setInventory(draft.id, "edition", 30);
    expect(result.ok).toBe(false);

    // Nothing was deleted by the refused shrink.
    const stillThere = await db.select().from(editions).where(eq(editions.variantId, variant.id));
    expect(stillThere).toHaveLength(50);
  });

  it("stores a plain quantity and clears the edition size", async () => {
    const draft = await createDraft("Quantity Product");
    const result = await setInventory(draft.id, "quantity", 12);
    expect(result.ok).toBe(true);

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.inventory).toEqual({ mode: "quantity", quantity: 12 });
  });

  describe("the size lock (issue #36 phase 3)", () => {
    it("allows growing or shrinking the edition freely before anything sells", async () => {
      const draft = await createDraft("Unsold Edition Product");
      expect((await setInventory(draft.id, "edition", 50)).ok).toBe(true);
      expect((await setInventory(draft.id, "edition", 75)).ok).toBe(true);
      expect((await setInventory(draft.id, "edition", 10)).ok).toBe(true);

      const admin = await getProductForAdmin(draft.id);
      expect(admin?.inventory.mode).toBe("edition");
      if (admin?.inventory.mode === "edition") {
        expect(admin.inventory.editionSize).toBe(10);
        expect(admin.inventory.sold).toBe(0);
      }
    });

    it("shrinking deletes the numbers that fall off the end", async () => {
      // The run has to BE the size it claims. Without the delete, 50 -> 20
      // leaves fifty rows behind and the run board reads "50 of 20 left",
      // counting surviving editions against an `editionSize` of 20.
      const draft = await createDraft("Shrunk Edition Product");
      await setInventory(draft.id, "edition", 50);

      const db = await getDb();
      const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
      if (!variant) throw new Error("expected a variant");
      expect(
        await db.select().from(editions).where(eq(editions.variantId, variant.id)),
      ).toHaveLength(50);

      expect((await setInventory(draft.id, "edition", 20)).ok).toBe(true);

      const rows = await db.select().from(editions).where(eq(editions.variantId, variant.id));
      expect(rows).toHaveLength(20);
      expect(Math.max(...rows.map((r) => r.number))).toBe(20);
    });

    it("refuses to shrink past a number held by an open checkout, and keeps every row", async () => {
      // A reserved number is somebody mid-payment. Deleting it would strand
      // them holding a number the run no longer has, so the save is refused
      // until the hold lapses rather than silently dropping it.
      const draft = await createDraft("Held Number Product");
      await setInventory(draft.id, "edition", 30);

      const db = await getDb();
      const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
      if (!variant) throw new Error("expected a variant");
      await db
        .update(editions)
        .set({ status: "reserved" })
        .where(and(eq(editions.variantId, variant.id), eq(editions.number, 25)));

      const result = await setInventory(draft.id, "edition", 10);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("25");

      expect(
        await db.select().from(editions).where(eq(editions.variantId, variant.id)),
      ).toHaveLength(30);
    });

    it("refuses to GROW the edition once a single number has sold, not just shrink it", async () => {
      const draft = await createDraft("Grown After Sale Product");
      await setInventory(draft.id, "edition", 50);

      const db = await getDb();
      const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
      if (!variant) throw new Error("expected a variant");
      await db
        .update(editions)
        .set({ status: "sold" })
        .where(and(eq(editions.variantId, variant.id), eq(editions.number, 1)));

      const result = await setInventory(draft.id, "edition", 60);
      expect(result).toEqual({
        ok: false,
        error: expect.stringContaining("locked"),
      });

      const stillThere = await db.select().from(editions).where(eq(editions.variantId, variant.id));
      expect(stillThere).toHaveLength(50);
    });

    it("re-saving the exact same size is a no-op even once something has sold", async () => {
      const draft = await createDraft("Resaved Edition Product");
      await setInventory(draft.id, "edition", 20);

      const db = await getDb();
      const [variant] = await db.select().from(variants).where(eq(variants.productId, draft.id));
      if (!variant) throw new Error("expected a variant");
      await db
        .update(editions)
        .set({ status: "sold" })
        .where(and(eq(editions.variantId, variant.id), eq(editions.number, 5)));

      const result = await setInventory(draft.id, "edition", 20);
      expect(result.ok).toBe(true);
    });

    it("EditionSizeLockedError carries the sold count and a human message", () => {
      const err = new EditionSizeLockedError(3);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("EditionSizeLockedError");
      expect(err.soldCount).toBe(3);
      expect(err.message).toMatch(/3 numbers have already sold/);
      expect(new EditionSizeLockedError(1).message).toMatch(/1 number has already sold/);
    });
  });
});

describe("image add/move/remove", () => {
  it("keeps positions contiguous through adds, a move and a removal", async () => {
    const draft = await createDraft("Gallery Product");

    const img1 = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/1.webp",
      urlThumb: "https://example.com/1-thumb.webp",
      width: 720,
      height: 720,
    });
    const img2 = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "BACK",
      alt: "back view alt text",
      urlFull: "https://example.com/2.webp",
      urlThumb: "https://example.com/2-thumb.webp",
      width: 720,
      height: 720,
    });
    const img3 = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "SIDE",
      alt: "side view alt text",
      urlFull: "https://example.com/3.webp",
      urlThumb: "https://example.com/3-thumb.webp",
      width: 720,
      height: 720,
    });

    let admin = await getProductForAdmin(draft.id);
    expect(admin?.views.map((v) => v.id)).toEqual([img1.id, img2.id, img3.id]);
    expect(admin?.views.map((v) => v.position)).toEqual([0, 1, 2]);

    await moveImage(img3.id, "up");
    admin = await getProductForAdmin(draft.id);
    expect(admin?.views.map((v) => v.id)).toEqual([img1.id, img3.id, img2.id]);
    expect(admin?.views.map((v) => v.position)).toEqual([0, 1, 2]);

    await removeImage(img1.id);
    admin = await getProductForAdmin(draft.id);
    expect(admin?.views.map((v) => v.id)).toEqual([img3.id, img2.id]);
    expect(admin?.views.map((v) => v.position)).toEqual([0, 1]);

    const db = await getDb();
    const rows = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, draft.id));
    expect(rows).toHaveLength(2);
  });
});

describe("addImage urlMid (issue #151)", () => {
  it("stores and surfaces the 400px cut when the caller passes one", async () => {
    const draft = await createDraft("Mid Cut Product");
    const img = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/1.webp",
      urlMid: "https://example.com/1-mid.webp",
      urlThumb: "https://example.com/1-thumb.webp",
      width: 720,
      height: 720,
    });

    const admin = await getProductForAdmin(draft.id);
    const view = admin?.views.find((v) => v.id === img.id);
    expect(view?.urlMid).toBe("https://example.com/1-mid.webp");
  });

  it("leaves urlMid null for a caller that doesn't pass one — no backfill of existing uploads", async () => {
    const draft = await createDraft("No Mid Cut Product");
    const img = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/1.webp",
      urlThumb: "https://example.com/1-thumb.webp",
      width: 720,
      height: 720,
    });

    const admin = await getProductForAdmin(draft.id);
    const view = admin?.views.find((v) => v.id === img.id);
    expect(view?.urlMid).toBeNull();
  });
});

describe("reorderProducts", () => {
  it("sets position 0..n-1 for the given order, and the storefront follows it", async () => {
    const a = await createDraft("Reorder Product A");
    const b = await createDraft("Reorder Product B");
    const c = await createDraft("Reorder Product C");

    for (const draft of [a, b, c]) {
      await makePriceableAndSized(draft.id);
      await addImage({
        productId: draft.id,
        kind: "view",
        viewId: crypto.randomUUID(),
        label: "FRONT",
        alt: "front view alt text",
        urlFull: "https://example.com/reorder.webp",
        urlThumb: "https://example.com/reorder-thumb.webp",
        width: 720,
        height: 720,
      });
      await setStatus(draft.id, "published");
    }

    const result = await reorderProducts([c.id, a.id, b.id]);
    expect(result).toEqual({ ok: true });

    const adminList = await listProductsForAdmin();
    const cRow = adminList.find((p) => p.id === c.id);
    const aRow = adminList.find((p) => p.id === a.id);
    const bRow = adminList.find((p) => p.id === b.id);
    expect(cRow?.position).toBe(0);
    expect(aRow?.position).toBe(1);
    expect(bRow?.position).toBe(2);

    const ids = adminList.map((p) => p.id);
    expect(ids.indexOf(c.id)).toBeLessThan(ids.indexOf(a.id));
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));

    const published = await listPublishedProducts();
    const slugs = published.map((p) => p.slug);
    expect(slugs.indexOf(c.slug)).toBeLessThan(slugs.indexOf(a.slug));
    expect(slugs.indexOf(a.slug)).toBeLessThan(slugs.indexOf(b.slug));
  });

  it("ignores ids that don't match any product", async () => {
    const result = await reorderProducts(["not-a-real-id", crypto.randomUUID()]);
    expect(result).toEqual({ ok: true });
  });
});

describe("duplicateProduct", () => {
  it("copies copy fields and images, gives a unique -copy slug, and starts a fresh draft with untouched editions", async () => {
    const draft = await createDraft("Duplicate Source Product");
    await updateProduct(draft.id, {
      name: "Duplicate Source Product",
      displayName1: "DUP SOURCE",
      displayName2: "PRODUCT",
      eyebrow: "eyebrow text",
      slug: draft.slug,
      priceCents: 4200,
      perOrderLimit: 3,
      oneSize: true,
      description: "description text",
      metaDescription: "meta description",
      limitedNote: "limited note",
      details: ["detail one", "detail two"],
      fit: "fits true to size",
      limitedCopy: "limited copy",
      why: "why copy",
      authenticityCopy: "authenticity copy",
      authenticityFacts: [{ label: "Capsule", value: "CNE-99" }],
      metaTitle: "Dup Source Title",
      metaKeywords: "dup, source, product",
      socialImageUrl: "/shop/dup-source.png",
      socialImageAlt: "The Duplicate Source Product in its packaging",
    });

    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/dup-1.webp",
      urlThumb: "https://example.com/dup-1-thumb.webp",
      width: 720,
      height: 720,
    });
    await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "BACK",
      alt: "back view alt text",
      urlFull: "https://example.com/dup-2.webp",
      urlThumb: "https://example.com/dup-2-thumb.webp",
      width: 720,
      height: 720,
    });

    await setInventory(draft.id, "edition", 5);

    const db = await getDb();
    const [variantRow] = await db.select().from(variants).where(eq(variants.productId, draft.id));
    if (!variantRow) throw new Error("expected a variant");
    await db
      .update(editions)
      .set({ status: "sold" })
      .where(and(eq(editions.variantId, variantRow.id), eq(editions.number, 1)));

    const result = await duplicateProduct(draft.id);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected duplicateProduct to succeed");
    expect(result.slug).toBe(`${draft.slug}-copy`);
    expect(result.id).not.toBe(draft.id);

    const dup = await getProductForAdmin(result.id);
    expect(dup?.status).toBe("draft");
    expect(dup?.name).toBe("Duplicate Source Product");
    expect(dup?.priceCents).toBe(4200);
    expect(dup?.details).toEqual(["detail one", "detail two"]);
    expect(dup?.authenticityFacts).toEqual([{ label: "Capsule", value: "CNE-99" }]);
    expect(dup?.metaTitle).toBe("Dup Source Title");
    expect(dup?.metaKeywords).toBe("dup, source, product");
    expect(dup?.socialImageUrl).toBe("/shop/dup-source.png");
    expect(dup?.socialImageAlt).toBe("The Duplicate Source Product in its packaging");
    expect(dup?.views).toHaveLength(2);
    expect(dup?.views.map((v) => v.urlFull).sort()).toEqual(
      ["https://example.com/dup-1.webp", "https://example.com/dup-2.webp"].sort(),
    );
    // Fresh, untouched editions of the same size — not a copy of the sold state.
    expect(dup?.inventory).toEqual({
      mode: "edition",
      editionSize: 5,
      sold: 0,
      reserved: 0,
      available: 5,
      setAside: 0,
    });

    // A second duplicate of the same source doesn't clash with the first copy's slug.
    const second = await duplicateProduct(draft.id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.slug).toBe(`${draft.slug}-copy-2`);
  });

  it("copies a plain-quantity variant with quantity reset to 0", async () => {
    const draft = await createDraft("Duplicate Quantity Product");
    await setInventory(draft.id, "quantity", 12);

    const result = await duplicateProduct(draft.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const dup = await getProductForAdmin(result.id);
    expect(dup?.inventory).toEqual({ mode: "quantity", quantity: 0 });
  });

  it("returns an error for a missing product", async () => {
    const result = await duplicateProduct(crypto.randomUUID());
    expect(result).toEqual({ ok: false, error: "Product not found." });
  });
});

describe("updateProductField", () => {
  it("rejects a bad slug and a negative price, and returns the field's previous value on success", async () => {
    const draft = await createDraft("Field Autosave Product");

    const badSlug = await updateProductField(draft.id, "slug", "Not A Valid Slug!");
    expect(badSlug).toEqual({
      ok: false,
      error: "Slug must be lowercase letters, numbers and hyphens only.",
    });

    const negativePrice = await updateProductField(draft.id, "priceCents", -100);
    expect(negativePrice.ok).toBe(false);

    const rename = await updateProductField(draft.id, "name", "Renamed Field Product");
    expect(rename).toEqual({ ok: true, previous: "Field Autosave Product" });

    const priceChange = await updateProductField(draft.id, "priceCents", 5500);
    expect(priceChange).toEqual({ ok: true, previous: 0 });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.name).toBe("Renamed Field Product");
    expect(admin?.priceCents).toBe(5500);
  });

  it("refuses a slug already used by another product", async () => {
    const a = await createDraft("Field Slug Clash A");
    const b = await createDraft("Field Slug Clash B");
    const result = await updateProductField(b.id, "slug", a.slug);
    expect(result.ok).toBe(false);
  });

  it("returns an error for a missing product", async () => {
    const result = await updateProductField(crypto.randomUUID(), "name", "Nope");
    expect(result).toEqual({ ok: false, error: "Product not found." });
  });

  it("accepts a meta title, rejects an over-length one, and stores an empty one as null", async () => {
    const draft = await createDraft("Meta Title Field Product");

    const accepted = await updateProductField(draft.id, "metaTitle", "A short, punchy title");
    expect(accepted).toEqual({ ok: true, previous: null });

    const tooLong = await updateProductField(draft.id, "metaTitle", "x".repeat(61));
    expect(tooLong).toEqual({
      ok: false,
      error: "Meta title must be 60 characters or fewer.",
    });

    const cleared = await updateProductField(draft.id, "metaTitle", "");
    expect(cleared).toEqual({ ok: true, previous: "A short, punchy title" });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.metaTitle).toBeNull();
  });

  it("accepts meta keywords, rejects an over-length list, and stores an empty one as null", async () => {
    const draft = await createDraft("Meta Keywords Field Product");

    const accepted = await updateProductField(draft.id, "metaKeywords", "hats, trucker, cap");
    expect(accepted).toEqual({ ok: true, previous: null });

    const tooLong = await updateProductField(draft.id, "metaKeywords", "x".repeat(161));
    expect(tooLong).toEqual({
      ok: false,
      error: "Meta keywords must be 160 characters or fewer.",
    });

    const cleared = await updateProductField(draft.id, "metaKeywords", "");
    expect(cleared).toEqual({ ok: true, previous: "hats, trucker, cap" });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.metaKeywords).toBeNull();
  });

  it("accepts a root-relative or https social image URL, rejects anything else, and stores an empty one as null", async () => {
    const draft = await createDraft("Social Image URL Field Product");

    const accepted = await updateProductField(draft.id, "socialImageUrl", "/shop/example.png");
    expect(accepted).toEqual({ ok: true, previous: null });

    const acceptedHttps = await updateProductField(
      draft.id,
      "socialImageUrl",
      "https://example.com/share.png",
    );
    expect(acceptedHttps).toEqual({ ok: true, previous: "/shop/example.png" });

    const relative = await updateProductField(draft.id, "socialImageUrl", "shop/example.png");
    expect(relative).toEqual({
      ok: false,
      error: `Social image URL must start with "/" or be an https:// URL.`,
    });

    const scripted = await updateProductField(draft.id, "socialImageUrl", "javascript:alert(1)");
    expect(scripted).toEqual({
      ok: false,
      error: `Social image URL must start with "/" or be an https:// URL.`,
    });

    const cleared = await updateProductField(draft.id, "socialImageUrl", "");
    expect(cleared).toEqual({ ok: true, previous: "https://example.com/share.png" });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.socialImageUrl).toBeNull();
  });

  it("accepts social image alt text, rejects one too short or too long, and stores an empty one as null", async () => {
    const draft = await createDraft("Social Image Alt Field Product");

    const accepted = await updateProductField(
      draft.id,
      "socialImageAlt",
      "The Foam Trucker in royal blue",
    );
    expect(accepted).toEqual({ ok: true, previous: null });

    const tooShort = await updateProductField(draft.id, "socialImageAlt", "short");
    expect(tooShort).toEqual({
      ok: false,
      error: "Alt text must be between 8 and 125 characters.",
    });

    const tooLong = await updateProductField(draft.id, "socialImageAlt", "x".repeat(126));
    expect(tooLong).toEqual({
      ok: false,
      error: "Alt text must be between 8 and 125 characters.",
    });

    const cleared = await updateProductField(draft.id, "socialImageAlt", "");
    expect(cleared).toEqual({ ok: true, previous: "The Foam Trucker in royal blue" });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.socialImageAlt).toBeNull();
  });
});

describe("backfillDraftSeo", () => {
  it("fills all four columns from the product once it has a name and none of them has been written", async () => {
    const draft = await createDraft("Backfill Fresh Product");
    const before = await getProductForAdmin(draft.id);
    expect(before?.metaTitle).toBeNull();
    expect(before?.metaDescription).toBe("");
    expect(before?.metaKeywords).toBeNull();
    expect(before?.socialImageAlt).toBeNull();

    await backfillDraftSeo(draft.id);

    const after = await getProductForAdmin(draft.id);
    const expected = draftStoredSeo({
      slug: after!.slug,
      name: after!.name,
      displayName1: after!.displayName1,
      displayName2: after!.displayName2,
      price: after!.priceCents / 100,
      eyebrow: after!.eyebrow,
      description: after!.description,
      limitedNote: after!.limitedNote,
    });
    expect(after?.metaTitle).toBe(expected.metaTitle);
    expect(after?.metaDescription).toBe(expected.metaDescription);
    expect(after?.metaKeywords).toBe(expected.metaKeywords);
    expect(after?.socialImageAlt).toBe(expected.socialImageAlt);
  });

  it("is a no-op once any of the four columns already has a value, so it never overwrites an owner's words", async () => {
    const draft = await createDraft("Backfill Written Product");
    const written = await updateProductField(draft.id, "metaTitle", "The owner's own title");
    expect(written.ok).toBe(true);

    await backfillDraftSeo(draft.id);

    const after = await getProductForAdmin(draft.id);
    expect(after?.metaTitle).toBe("The owner's own title");
    // The other three columns stay untouched too — the whole backfill is
    // skipped, not just the column that already had something in it.
    expect(after?.metaDescription).toBe("");
    expect(after?.metaKeywords).toBeNull();
    expect(after?.socialImageAlt).toBeNull();
  });

  it("is a no-op for a nameless draft, since there's nothing to derive copy from", async () => {
    const draft = await createDraft("");
    await backfillDraftSeo(draft.id);

    const after = await getProductForAdmin(draft.id);
    expect(after?.metaTitle).toBeNull();
    expect(after?.metaDescription).toBe("");
    expect(after?.metaKeywords).toBeNull();
    expect(after?.socialImageAlt).toBeNull();
  });
});

describe("applyProductChanges", () => {
  it("applies a mixed batch across two products in one call", async () => {
    const a = await createDraft("Sheet Batch Product A");
    const b = await createDraft("Sheet Batch Product B");

    const result = await applyProductChanges([
      { id: a.id, field: "name", value: "Batch Renamed A" },
      { id: a.id, field: "priceCents", value: 3300 },
      { id: b.id, field: "eyebrow", value: "Batch eyebrow B" },
    ]);
    expect(result).toEqual({ ok: true, applied: 3 });

    const adminA = await getProductForAdmin(a.id);
    const adminB = await getProductForAdmin(b.id);
    expect(adminA?.name).toBe("Batch Renamed A");
    expect(adminA?.priceCents).toBe(3300);
    expect(adminB?.eyebrow).toBe("Batch eyebrow B");
  });

  it("a later change to the same product/field wins", async () => {
    const draft = await createDraft("Sheet Last Write Wins Product");

    const result = await applyProductChanges([
      { id: draft.id, field: "priceCents", value: 1000 },
      { id: draft.id, field: "priceCents", value: 2000 },
    ]);
    expect(result).toEqual({ ok: true, applied: 2 });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.priceCents).toBe(2000);
  });

  it("rolls back the whole batch when one change is invalid, and reports its index", async () => {
    const a = await createDraft("Sheet Rollback Product A");
    const b = await createDraft("Sheet Rollback Product B");

    const result = await applyProductChanges([
      { id: a.id, field: "name", value: "Should Not Stick" },
      { id: b.id, field: "priceCents", value: -500 },
      { id: a.id, field: "eyebrow", value: "Also should not stick" },
    ]);
    expect(result).toEqual({
      ok: false,
      error: "Price must be zero or a positive whole number of cents.",
      failedIndex: 1,
    });

    const adminA = await getProductForAdmin(a.id);
    const adminB = await getProductForAdmin(b.id);
    expect(adminA?.name).toBe("Sheet Rollback Product A");
    expect(adminA?.eyebrow).toBe("");
    expect(adminB?.priceCents).toBe(0);
  });

  it("sets the count for a quantity-mode product via inventoryN", async () => {
    const draft = await createDraft("Sheet Inventory Quantity Product");
    await setInventory(draft.id, "quantity", 10);

    const result = await applyProductChanges([{ id: draft.id, field: "inventoryN", value: 25 }]);
    expect(result).toEqual({ ok: true, applied: 1 });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.inventory).toEqual({ mode: "quantity", quantity: 25 });
  });

  it("refuses inventoryN for a product with no tracked inventory", async () => {
    const draft = await createDraft("Sheet Untracked Inventory Product");

    const result = await applyProductChanges([{ id: draft.id, field: "inventoryN", value: 10 }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedIndex).toBe(0);
    }
  });
});

describe("reorderImages", () => {
  it("reorders a product's view images and ignores an id from a different product", async () => {
    const draft = await createDraft("Image Reorder Product");
    const other = await createDraft("Other Product For Image Reorder");

    const img1 = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "front view alt text",
      urlFull: "https://example.com/r1.webp",
      urlThumb: "https://example.com/r1-thumb.webp",
      width: 720,
      height: 720,
    });
    const img2 = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "BACK",
      alt: "back view alt text",
      urlFull: "https://example.com/r2.webp",
      urlThumb: "https://example.com/r2-thumb.webp",
      width: 720,
      height: 720,
    });
    const img3 = await addImage({
      productId: draft.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "SIDE",
      alt: "side view alt text",
      urlFull: "https://example.com/r3.webp",
      urlThumb: "https://example.com/r3-thumb.webp",
      width: 720,
      height: 720,
    });
    const otherImg = await addImage({
      productId: other.id,
      kind: "view",
      viewId: crypto.randomUUID(),
      label: "FRONT",
      alt: "other product front alt text",
      urlFull: "https://example.com/o1.webp",
      urlThumb: "https://example.com/o1-thumb.webp",
      width: 720,
      height: 720,
    });

    const result = await reorderImages(draft.id, [img3.id, img1.id, otherImg.id, img2.id]);
    expect(result).toEqual({ ok: true });

    const admin = await getProductForAdmin(draft.id);
    expect(admin?.views.map((v) => v.id)).toEqual([img3.id, img1.id, img2.id]);
    expect(admin?.views.map((v) => v.position)).toEqual([0, 1, 2]);

    const otherAdmin = await getProductForAdmin(other.id);
    expect(otherAdmin?.views.map((v) => v.id)).toEqual([otherImg.id]);
    expect(otherAdmin?.views[0]?.position).toBe(0);
  });
});

describe("storefront exclusion", () => {
  it("listPublishedProducts never includes a draft or an archived product", async () => {
    const draft = await createDraft("Hidden Draft Product");
    const archived = await createDraft("Hidden Archived Product");
    await setStatus(archived.id, "published");
    await setStatus(archived.id, "archived");

    const published = await listPublishedProducts();
    expect(published.some((p) => p.slug === draft.slug)).toBe(false);
    expect(published.some((p) => p.slug === archived.slug)).toBe(false);

    const adminList = await listProductsForAdmin();
    expect(adminList.some((p) => p.slug === draft.slug)).toBe(true);
    expect(adminList.some((p) => p.slug === archived.slug)).toBe(true);
  });
});
