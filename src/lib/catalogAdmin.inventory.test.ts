import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { editions, variants } from "@/db/schema";
import {
  createDraft,
  EditionSizeLockedError,
  getProductForAdmin,
  setInventory,
} from "@/lib/catalogAdmin";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
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
