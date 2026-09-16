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
import { after } from "next/server";
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
 *
 * The revalidation itself runs inside `after()` (issue #38) rather than
 * before this function returns. `updateStoreSettings` finishes in
 * single-digit milliseconds on its own — the delay owners saw in the
 * "Settings saved" toast was never the save, or even the handful of
 * `revalidatePath`/`revalidateTag` calls below, which are just as fast.
 * It was Next's own behavior: calling `revalidatePath`/`revalidateTag`
 * during a Server Action marks `workStore.pathWasRevalidated`, and the
 * action handler (`next/dist/server/app-render/action-handler.js`) reads
 * that flag right after the action returns to decide whether to also
 * render a fresh RSC payload for the page the action was called from —
 * `/admin/settings` — into the *same* response, gating the toast on
 * `AdminSettingsPage`'s own DB reads (plus every card's) finishing too,
 * all serialized through PGlite's one connection alongside whatever else
 * the app is doing. None of the paths revalidated here
 * (`/shop/`, `/returns/`, `/terms/`, product pages) are ever read by
 * `/admin/settings`, so that re-render was pure overhead, not
 * freshness this page needed.
 *
 * `after()`'s callback runs once the response has been sent, well after
 * `pathWasRevalidated` was already read as `false` for this request — so
 * the client gets `result` back as soon as the save itself is done, and
 * the storefront still gets revalidated moments later without ever being
 * in the critical path. `revalidatePath`/`revalidateTag` are explicitly
 * supported inside `after()` (`AfterContext.runCallbacks` wraps its queue
 * in `withExecuteRevalidates`), so this isn't relying on undocumented
 * behavior.
 */
export async function saveStoreSettings(
  patch: StoreSettingsPatch,
): Promise<UpdateStoreSettingsResult> {
  await requireOwner();
  const result = await updateStoreSettings(patch);
  if (!result.ok) return result;

  if (!isTestEnv()) {
    after(async () => {
      revalidateTag("catalogue");
      revalidatePath("/shop/");
      revalidatePath("/returns/");
      revalidatePath("/terms/");
      // Every product page renders the "Shipping & returns" line built from
      // these settings, not just the ones whose own catalogue data changed.
      const products = await listPublishedProducts();
      for (const product of products) revalidatePath(`/shop/${product.slug}/`);
    });
  }

  return result;
}
