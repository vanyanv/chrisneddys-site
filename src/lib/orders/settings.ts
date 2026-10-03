/**
 * The store settings row (shipping, pickup, pause, returns) and the flat
 * shipping charge it implies.
 *
 * Part of `@/lib/orders` (see `src/lib/orders.ts`), which re-exports the
 * public names; import from there, not from here.
 */
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { Db } from "@/db/client";
import { storeSettings } from "@/db/schema";
import { type Fulfilment, isTestEnv, resolveDb } from "./shared";

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

export type StoreSettings = typeof storeSettings.$inferSelect;

/** Reads the single `store_settings` row, creating a bare-default one on the
 * (in practice, seed-only) chance it doesn't exist yet. */
export async function getStoreSettings(db?: Db): Promise<StoreSettings> {
  const database = await resolveDb(db);
  const existing = await database.query.storeSettings.findFirst({
    where: eq(storeSettings.id, "default"),
  });
  if (existing) return existing;

  const [created] = await database
    .insert(storeSettings)
    .values({ id: "default", storeName: "Store", supportEmail: "support@example.com" })
    .onConflictDoNothing({ target: storeSettings.id })
    .returning();
  if (created) return created;

  // Someone else created it between the read and the insert above.
  const row = await database.query.storeSettings.findFirst({
    where: eq(storeSettings.id, "default"),
  });
  if (!row) throw new Error("store_settings default row missing and could not be created");
  return row;
}

/** Matches the storefront layout's one-day window. A cached read's
 * `revalidate` also caps the window of every page that makes it, and the
 * layout makes it on every page, so a shorter value here would quietly pull
 * the whole site back to it. `saveStoreSettings` clears the tag on every
 * save, so this is a safety net, never what makes a change appear. */
const REVALIDATE_SECONDS = 86400;

/** Tag for the cached storefront settings read below. Every write to
 * `store_settings` has to clear it — see `saveStoreSettings`. */
export const STORE_SETTINGS_TAG = "store-settings";

const cachedStoreSettings = unstable_cache(() => getStoreSettings(), ["store-settings"], {
  tags: [STORE_SETTINGS_TAG],
  revalidate: REVALIDATE_SECONDS,
});

/**
 * `unstable_cache` stores what it caches as JSON, so a `timestamp` column
 * comes back out of it as an ISO string rather than the `Date` the row type
 * promises. `/returns/` and `/terms/` both call `updatedAt.toISOString()` to
 * stamp their "last updated" line, and a string has no such method — this is
 * what a cached settings read has to put back before handing the row on.
 */
export function reviveStoreSettings(row: StoreSettings): StoreSettings {
  return { ...row, updatedAt: new Date(row.updatedAt) };
}

/**
 * The storefront's read of `store_settings` — the store name, the shipping
 * and returns copy, and whether the shop is open.
 *
 * `getStoreSettings` above goes to the database every single time it is
 * called, which is right for checkout, the Stripe webhook and `/admin` (all
 * of which must never act on a stale row) but wrong for rendering a page:
 * `src/app/(site)/layout.tsx` calls it on *every* storefront page and the
 * page underneath then calls it again, so a page whose product data was
 * entirely cached still made two database round trips before it could
 * render. This is that same read, cached (for a day; see
 * `REVALIDATE_SECONDS`) the way `src/lib/catalog.ts` caches the catalogue, and wrapped in React's `cache`
 * so the layout and the page share one call within a single render instead
 * of two.
 *
 * Owners never wait for that window: `saveStoreSettings` clears
 * `STORE_SETTINGS_TAG` on every save, so a change is live on the storefront
 * as soon as it is saved. Anything that must read the row as it stands right
 * now — checkout's open/paused gate, the admin's own screens — keeps calling
 * `getStoreSettings` directly.
 */
export const getPublicStoreSettings = cache(async (): Promise<StoreSettings> => {
  if (isTestEnv()) return getStoreSettings();
  return reviveStoreSettings(await cachedStoreSettings());
});

export type StoreSettingsPatch = Partial<{
  storeName: string;
  supportEmail: string;
  pickupEnabled: boolean;
  pickupAddress: string;
  shippingFlatCents: number;
  shippingFreeOverCents: number | null;
  shipCountries: string[];
  returnsPolicy: string | null;
  termsText: string | null;
  shipsWithin: string | null;
  shopPaused: boolean;
  pauseNote: string | null;
}>;

export type UpdateStoreSettingsResult =
  | { ok: true; settings: StoreSettings }
  | { ok: false; error: string; field?: keyof StoreSettingsPatch };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

/** Long enough for "Back Thursday" or a sentence, short enough that it
 * can't turn into a second returns policy pasted into the wrong field. */
const PAUSE_NOTE_MAX_LENGTH = 140;

/** Long enough for "5-7 business days", short enough that it can't turn
 * into a second sentence folded into `shopCopy.ts`'s one-line shipping
 * clause ("Ships within {this}."). */
const SHIPS_WITHIN_MAX_LENGTH = 60;

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/** Validates `patch`, then merges it into the single `store_settings` row. */
export async function updateStoreSettings(
  patch: StoreSettingsPatch,
  db?: Db,
): Promise<UpdateStoreSettingsResult> {
  const database = await resolveDb(db);

  if (patch.supportEmail !== undefined && !EMAIL_PATTERN.test(patch.supportEmail)) {
    return { ok: false, error: "Support email is not a valid email address." };
  }
  if (patch.shippingFlatCents !== undefined && !isNonNegativeInt(patch.shippingFlatCents)) {
    return { ok: false, error: "Flat shipping rate must be a non-negative whole number of cents." };
  }
  if (
    patch.shippingFreeOverCents !== undefined &&
    patch.shippingFreeOverCents !== null &&
    !isNonNegativeInt(patch.shippingFreeOverCents)
  ) {
    return {
      ok: false,
      error: "Free-shipping threshold must be a non-negative whole number of cents.",
    };
  }
  if (patch.shipCountries !== undefined) {
    const bad = patch.shipCountries.find((c) => !COUNTRY_PATTERN.test(c));
    if (bad !== undefined) {
      return { ok: false, error: `"${bad}" is not an uppercase ISO-2 country code.` };
    }
  }
  if (
    patch.pauseNote !== undefined &&
    patch.pauseNote !== null &&
    patch.pauseNote.length > PAUSE_NOTE_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Keep the pause note under ${PAUSE_NOTE_MAX_LENGTH} characters.`,
      field: "pauseNote",
    };
  }
  if (
    patch.shipsWithin !== undefined &&
    patch.shipsWithin !== null &&
    patch.shipsWithin.length > SHIPS_WITHIN_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Keep "Ships within" under ${SHIPS_WITHIN_MAX_LENGTH} characters.`,
      field: "shipsWithin",
    };
  }

  // Also ensures the row exists before the update below.
  const current = await getStoreSettings(database);

  // A pickup counter with no address is not a real pickup option — checked
  // against the *effective* patch (what the row would read after this
  // write), so blanking the address while pickup is already on is caught
  // exactly the same as flipping pickup on over an address that's already
  // blank.
  const effectivePickupEnabled = patch.pickupEnabled ?? current.pickupEnabled;
  const effectivePickupAddress = (patch.pickupAddress ?? current.pickupAddress).trim();
  if (effectivePickupEnabled && !effectivePickupAddress) {
    return {
      ok: false,
      error: "Add the pickup address, or turn pickup off.",
      field: "pickupAddress",
    };
  }

  const [row] = await database
    .update(storeSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(storeSettings.id, "default"))
    .returning();
  if (!row) throw new Error("update of store_settings returned nothing");
  return { ok: true, settings: row };
}

export function computeShippingCents(
  fulfilment: Fulfilment,
  subtotalCents: number,
  settings: StoreSettings,
): number {
  if (fulfilment === "pickup") return 0;
  if (settings.shippingFreeOverCents !== null && subtotalCents >= settings.shippingFreeOverCents) {
    return 0;
  }
  return settings.shippingFlatCents;
}
