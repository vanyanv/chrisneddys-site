import "server-only";

/**
 * What the internal shop API does beyond a plain pass-through to the admin
 * layer: request validation that the admin gets from its forms, and the
 * storefront revalidation each admin server action performs after a write.
 * The rules themselves stay in `catalogAdmin`, `settingsAdmin` and `orders`.
 */
import {
  applyProductChanges,
  backfillDraftSeo,
  getProductForAdmin,
  setInventory,
  setStatus,
  type ApplyProductChangesResult,
  type ProductChange,
} from "@/lib/catalogAdmin";
import { catalogueChanged, type StoreSettingsPatch } from "@/lib/orders";

export type InternalResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const STATUSES = ["draft", "published", "archived"] as const;
type ProductStatus = (typeof STATUSES)[number];

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** Mirrors `setProductStatusAction` (including `setStatus`'s publish checks). */
export async function setProductStatusInternal(
  id: string,
  status: ProductStatus,
): Promise<InternalResult> {
  const result = await setStatus(id, status);
  if (!result.ok) return result;
  catalogueChanged([result.slug]);
  return { ok: true };
}

/** Mirrors `setInventoryPlainAction`, for a product already in quantity mode. */
export async function setQuantityInternal(
  id: string,
  count: unknown,
): Promise<InternalResult & { notFound?: boolean }> {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    return { ok: false, error: "count must be a whole number, 0 or more." };
  }
  const product = await getProductForAdmin(id);
  if (!product) return { ok: false, error: "Product not found.", notFound: true };
  if (product.inventory.mode === "edition") {
    return {
      ok: false,
      error:
        "This product is a numbered edition; its run size is not a count that can be set here.",
    };
  }
  if (product.inventory.mode !== "quantity") {
    return { ok: false, error: "This product does not track a quantity." };
  }
  const result = await setInventory(id, "quantity", count);
  if (!result.ok) return result;
  catalogueChanged([result.slug]);
  return { ok: true };
}

const CHANGE_LIMIT = 200;

/** `null` when `value` is not a list of `{id, field, value}` changes. */
export function parseProductChanges(value: unknown): ProductChange[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > CHANGE_LIMIT) return null;
  for (const c of value) {
    if (
      c === null ||
      typeof c !== "object" ||
      typeof (c as ProductChange).id !== "string" ||
      typeof (c as ProductChange).field !== "string" ||
      // Counts go through the inventory route, which checks them; here
      // `applyProductChanges` would coerce null or true to 0 or 1.
      (c as ProductChange).field === "inventoryN" ||
      (c as ProductChange).field === "onlineN" ||
      !("value" in c)
    ) {
      return null;
    }
  }
  return value as ProductChange[];
}

/** Mirrors `applyProductChangesAction`: atomic batch, SEO backfill for
 * drafts, and revalidation of every slug touched (before and after). */
export async function applyProductChangesInternal(
  changes: ProductChange[],
): Promise<ApplyProductChangesResult> {
  const touchedIds = Array.from(new Set(changes.map((c) => c.id)));
  const slugsOf = async () =>
    (await Promise.all(touchedIds.map((id) => getProductForAdmin(id))))
      .filter((p) => p !== undefined)
      .map((p) => p.slug);
  const oldSlugs = await slugsOf();

  const result = await applyProductChanges(changes);
  if (!result.ok) return result;

  for (const id of touchedIds) await backfillDraftSeo(id);
  catalogueChanged([...oldSlugs, ...(await slugsOf())]);
  return result;
}

const SETTINGS_KEYS = [
  "storeName",
  "supportEmail",
  "pickupEnabled",
  "pickupAddress",
  "shippingFlatCents",
  "shippingFreeOverCents",
  "shipCountries",
  "returnsPolicy",
  "termsText",
  "shipsWithin",
  "shopPaused",
  "pauseNote",
] as const;

const NULLABLE_TEXT = ["returnsPolicy", "termsText", "shipsWithin", "pauseNote"] as const;

/**
 * Validates a JSON settings patch the way `saveSettingsAction` validates its
 * form (trimmed text, a named store, a real support email, upper-cased
 * two-letter countries, blank optional text becomes null), then hands the
 * typed patch on. Limits that `updateStoreSettings` enforces (pause-note and
 * ships-within length, pickup needing an address, non-negative cents) are
 * left to it so there is one implementation of each.
 */
export function parseSettingsPatch(
  body: Record<string, unknown>,
): { ok: true; patch: StoreSettingsPatch } | { ok: false; error: string } {
  const unknown = Object.keys(body).find((k) => !(SETTINGS_KEYS as readonly string[]).includes(k));
  if (unknown) return { ok: false, error: `Unknown setting "${unknown}".` };

  const patch: Record<string, unknown> = {};
  const bad = (error: string) => ({ ok: false as const, error });

  for (const key of ["storeName", "supportEmail", "pickupAddress"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string") return bad(`${key} must be text.`);
    patch[key] = (body[key] as string).trim();
  }
  if (patch.storeName === "") return bad("Give the store a name.");
  if (
    patch.supportEmail !== undefined &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.supportEmail as string)
  ) {
    return bad("Enter a valid email address.");
  }

  for (const key of ["pickupEnabled", "shopPaused"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return bad(`${key} must be true or false.`);
    patch[key] = body[key];
  }

  if (body.shippingFlatCents !== undefined) {
    if (typeof body.shippingFlatCents !== "number")
      return bad("shippingFlatCents must be a number.");
    patch.shippingFlatCents = body.shippingFlatCents;
  }
  if (body.shippingFreeOverCents !== undefined) {
    if (body.shippingFreeOverCents !== null && typeof body.shippingFreeOverCents !== "number") {
      return bad("shippingFreeOverCents must be a number or null.");
    }
    patch.shippingFreeOverCents = body.shippingFreeOverCents;
  }

  if (body.shipCountries !== undefined) {
    if (
      !Array.isArray(body.shipCountries) ||
      body.shipCountries.some((c) => typeof c !== "string")
    ) {
      return bad("shipCountries must be a list of country codes.");
    }
    const countries = (body.shipCountries as string[])
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (countries.length === 0) return bad("List at least one ISO-2 country code, e.g. US.");
    const badCode = countries.find((c) => !/^[A-Z]{2}$/.test(c));
    if (badCode !== undefined) return bad(`"${badCode}" isn't a two-letter country code.`);
    patch.shipCountries = countries;
  }

  for (const key of NULLABLE_TEXT) {
    if (body[key] === undefined) continue;
    if (body[key] !== null && typeof body[key] !== "string")
      return bad(`${key} must be text or null.`);
    patch[key] = typeof body[key] === "string" ? (body[key] as string).trim() || null : null;
  }

  return { ok: true, patch: patch as StoreSettingsPatch };
}
