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
  createDraft,
  getProductForAdmin,
  listProductsForAdmin,
  moveImage,
  removeImage,
  setInventory,
  setStatus,
  updateProduct,
} from "@/lib/catalogAdmin";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

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
    });
    expect(result.ok).toBe(false);
  });
});

describe("setStatus", () => {
  it("stamps published_at only the first time a product is published", async () => {
    const draft = await createDraft("Status Test Product");
    const before = await getProductForAdmin(draft.id);
    expect(before?.publishedAt).toBeNull();

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
