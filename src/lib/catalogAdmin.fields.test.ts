import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import {
  applyProductChanges,
  createDraft,
  getProductForAdmin,
  setInventory,
  updateProductField,
} from "@/lib/catalogAdmin";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
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
