"use server";

/** `/admin/catering/settings/` — its own save action against
 * `catering_settings`, independent of the store's own `saveSettingsAction`
 * (a different table, a different page, a different form, its own sticky
 * save bar). Mirrors
 * `../settings/actions.ts`'s `saveSettingsAction` shape: parse-then-validate
 * server-side, `saveCateringSettings` (`@/lib/catering/settings`) is the
 * real source of truth for every rule this enforces. */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOwner } from "@/lib/auth";
import { saveCateringSettings, type CateringSettingsPatch } from "@/lib/catering/settings";
import type { CateringDayOff, CateringHours } from "@/db/schema";

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

export type SaveCateringSettingsState = {
  ok?: boolean;
  error?: string;
  savedAt?: string;
  field?: string;
};

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export async function saveCateringSettingsAction(
  _prevState: SaveCateringSettingsState | undefined,
  formData: FormData,
): Promise<SaveCateringSettingsState> {
  await requireOwner();

  const orderingOn = formData.get("orderingOn") === "on";

  let hours: CateringHours;
  let daysOff: CateringDayOff[];
  try {
    hours = JSON.parse(String(formData.get("hours") ?? "{}")) as CateringHours;
    daysOff = JSON.parse(String(formData.get("daysOff") ?? "[]")) as CateringDayOff[];
  } catch {
    return { error: "Couldn't read the hours or days-off you set — reload and try again." };
  }

  const rangeMiles = Number(formData.get("rangeMiles"));
  const deliveryFeeCents = dollarsToCents(String(formData.get("deliveryFeeDollars") ?? ""));
  const replyHours = Number(formData.get("replyHours"));
  const leadHours = Number(formData.get("leadHours"));
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();

  const patch: CateringSettingsPatch = {
    orderingOn,
    hours,
    daysOff,
    rangeMiles,
    deliveryFeeCents,
    replyHours,
    leadHours,
    ownerEmail,
  };

  const result = await saveCateringSettings(patch);
  if (!result.ok) return { error: result.error, field: result.field };

  // Every `revalidatePath` call here is deferred into `after()` — none run
  // inline. Calling `revalidatePath` during the action itself marks
  // `workStore.pathWasRevalidated`, which makes Next render a fresh RSC
  // payload for the revalidated page into *this* response before the action
  // resolves. That's cheap for one page, but it also means the response
  // waits on Next kicking off regeneration for whichever paths were named,
  // competing for the same single PGlite connection `saveCateringSettings`
  // just used — and empirically (a clean, single-process `next start`) that
  // doesn't just add latency: the client's `useActionState` promise never
  // resolves at all (`SAVING…`, confirmed stuck for 90+ seconds), even
  // though server-side logging shows the action itself returns and the HTTP
  // response body arrives at the browser complete and well-formed.
  //
  // Deferring all of it into `after()` avoids that entirely, and nothing
  // depends on the inline RSC refresh: `/admin/catering/settings/`'s save bar shows
  // the saved values from `useActionState`'s own result (keyed by
  // `savedAt`), not from a fresh server render riding the action response.
  // `/catering/order/` is `force-dynamic`, so it has no Full Route Cache
  // entry to purge and needs no revalidation at all. `/catering/`,
  // `/order/` and `/menu/` are static/ISR pages that also read
  // `getPublicCateringConfig()`, so they still need revalidating on a
  // save — just not inline. This is the configuration measured at 20/20 in
  // commit b52a70e.
  if (!isTestEnv()) {
    after(() => {
      // The admin pages that show the catering on/off pill or read these
      // settings. `/admin/settings` is the shop's page now and no longer
      // shows anything from `catering_settings`, so it isn't listed.
      revalidatePath("/admin/catering/settings");
      revalidatePath("/admin/catering");
      revalidatePath("/admin/catering/emails");
      revalidatePath("/admin");
      revalidatePath("/catering/");
      revalidatePath("/order/");
      revalidatePath("/menu/");
    });
  }
  return { ok: true, savedAt: new Date().toISOString() };
}
