import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { productImages } from "@/db/schema";
import {
  addImage,
  createDraft,
  getProductForAdmin,
  reorderImages,
  removeImage,
} from "@/lib/catalogAdmin";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

describe("image add/remove", () => {
  it("keeps positions contiguous through adds and a removal", async () => {
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

    await removeImage(img1.id);
    admin = await getProductForAdmin(draft.id);
    expect(admin?.views.map((v) => v.id)).toEqual([img2.id, img3.id]);
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
