"use server";

/** `/admin/settings`'s "Catering" section — its own save action against
 * `catering_settings`, independent of the store's own `saveSettingsAction`
 * (a different table, a different form, its own sticky save bar). Mirrors
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
  const bigLeadHours = Number(formData.get("bigLeadHours"));
  const bigHeadcount = Number(formData.get("bigHeadcount"));
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();

  const patch: CateringSettingsPatch = {
    orderingOn,
    hours,
    daysOff,
    rangeMiles,
    deliveryFeeCents,
    replyHours,
    leadHours,
    bigLeadHours,
    bigHeadcount,
    ownerEmail,
  };

  const result = await saveCateringSettings(patch);
  if (!result.ok) return { error: result.error, field: result.field };

  // Deferred to `after()`, same reasoning (and the same PGlite-single-
  // connection risk) as `saveStoreSettings` in `@/lib/settingsAdmin`:
  // calling `revalidatePath` inline during a Server Action makes Next
  // render a fresh RSC payload for *this* page (`/admin/settings`, which
  // reads five separate things, including this same catering-settings
  // row) into the action's own response before it can resolve. Racing
  // that against the admin nav's own `<Link>` prefetches to
  // `/admin/catering`, `/admin/orders`, `/admin/customers` etc. — which
  // revalidating `/admin` (the shared layout segment) invalidates and
  // re-triggers — serializes a pile of unrelated reads onto PGlite's one
  // connection ahead of the response, which is what left the Save button
  // stuck on "Saving…" (or occasionally applied a stale RSC payload over
  // the just-saved value). Running it in `after()` keeps these three
  // paths fresh without ever putting that render in the action's own
  // critical path.
  if (!isTestEnv()) {
    after(() => {
      revalidatePath("/admin/settings");
      revalidatePath("/admin/catering");
      revalidatePath("/admin");
    });
  }
  return { ok: true, savedAt: new Date().toISOString() };
}
