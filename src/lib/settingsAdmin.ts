import "server-only";

/**
 * The admin write layer for `/admin/settings`. Every field an owner sets
 * here — shipping, pickup, support email, the returns policy, the terms of
 * sale — is read straight off `src/lib/orders.ts`'s single `store_settings`
 * row by four things a customer can see: `/returns/`, `/terms/`, `/shop/`
 * and every `/shop/<slug>/` page (through `src/lib/shopCopy.ts`'s "Shipping
 * & returns" line). A save here has to make all four show the new text
 * immediately, not after the next ISR window — that's what
 * California Civil Code §1723 and Stripe's own contact/refund-policy
 * requirement are asking for.
 *
 * `requireOwner()` lives here rather than in the server action so a saved
 * settings change can never reach `updateStoreSettings` without a checked
 * owner session, the same shape `catalogAdmin.ts` follows for products.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { listPublishedProducts } from "@/lib/catalog";
import {
  getStoreSettings,
  updateStoreSettings,
  type StoreSettings,
  type StoreSettingsPatch,
  type UpdateStoreSettingsResult,
} from "@/lib/orders";

export type { StoreSettings, StoreSettingsPatch, UpdateStoreSettingsResult };

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/** Reads the settings row for the /admin/settings page. Requires an owner session. */
export async function getSettingsForAdmin(): Promise<StoreSettings> {
  await requireOwner();
  return getStoreSettings();
}

/**
 * Validates and saves a patch to store settings (via `updateStoreSettings`'s
 * own validation), then revalidates every storefront page the change could
 * be seen on. No-op under Vitest, where there is no request/render context
 * for `next/cache` to act on — same convention as `catalogueChanged` in
 * `src/lib/orders.ts`.
 */
export async function saveStoreSettings(
  patch: StoreSettingsPatch,
): Promise<UpdateStoreSettingsResult> {
  await requireOwner();
  const result = await updateStoreSettings(patch);
  if (!result.ok) return result;

  if (!isTestEnv()) {
    revalidateTag("catalogue");
    revalidatePath("/shop/");
    revalidatePath("/returns/");
    revalidatePath("/terms/");
    // Every product page renders the "Shipping & returns" line built from
    // these settings, not just the ones whose own catalogue data changed.
    const products = await listPublishedProducts();
    for (const product of products) revalidatePath(`/shop/${product.slug}/`);
  }

  return result;
}
