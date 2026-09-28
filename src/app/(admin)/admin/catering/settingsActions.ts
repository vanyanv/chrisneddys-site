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

  // `/admin/settings` itself is revalidated INLINE (unlike the other two
  // paths below): calling `revalidatePath` during a Server Action marks
  // `workStore.pathWasRevalidated`, which is what makes Next render a
  // fresh RSC payload for *this* page into the action's own response
  // before it resolves — that's exactly the freshness this checkbox
  // needs, since `/admin/settings` is the page actually showing the
  // catering-settings row just written. Skipping it (deferring it into
  // `after()` the same as the other two, as an earlier version of this
  // fix did) doesn't just delay that re-render: React's `useActionState`
  // applies whatever RSC payload rides along with the action's response
  // regardless, so without an inline `revalidatePath` for this exact path
  // that payload is Next's *stale*, pre-save render of the page — which
  // silently snapped the just-toggled checkbox back to its old value the
  // instant the save resolved, even though the write itself had already
  // committed. `/admin/settings` only reads its own five things (this
  // catering-settings row among them), so this render is cheap on its
  // own — the risk was never revalidating *this* page, only revalidating
  // `/admin` (the shared layout segment, below).
  revalidatePath("/admin/settings/");

  // The four storefront pages below are ALSO revalidated INLINE, not
  // deferred, even though this action is never called from any of them:
  // they all read `getPublicCateringConfig()` (`@/lib/catering/public`)
  // for `orderingOn`, and none declares `dynamic = "force-dynamic"`, so
  // per this repo's "storefront pages are static with revalidation" rule
  // (CLAUDE.md) each is a static/ISR page that only picks up a settings
  // change once something calls `revalidatePath` for it — nothing did,
  // for this action, until now. Deferring them into `after()` (as an
  // earlier version of this fix did, reasoning by analogy with the
  // `/admin`/`/admin/catering` case below) is provably too late for any
  // caller that flips the toggle and then immediately checks the
  // storefront in the same flow — exactly what `enableCateringOrdering`/
  // `disableCateringOrdering` (`e2e/catering/helpers.ts`) do, and what a
  // real owner testing their own change right after saving would do too:
  // `after()` only guarantees these run "once the response has been
  // sent", not before the *next* request the caller makes, so a
  // `page.goto("/catering/order/")` right after the save can land on the
  // server before the deferred revalidation has even started, and gets
  // served the stale, pre-save static page — with nothing to retry, since
  // a plain navigation is a one-shot fetch, not a polled assertion. These
  // four are cheap, ordinary page reads with no nav-prefetch fan-out (they
  // aren't part of the admin layout), so revalidating them inline carries
  // none of the risk that made revalidating `/admin` inline dangerous.
  revalidatePath("/catering/");
  revalidatePath("/catering/order/");
  revalidatePath("/order/");
  revalidatePath("/menu/");

  // Deferred to `after()`, same reasoning (and the same PGlite-single-
  // connection risk) as `saveStoreSettings` in `@/lib/settingsAdmin`:
  // revalidating `/admin` (the shared layout segment) invalidates and
  // re-triggers the admin nav's own `<Link>` prefetches to
  // `/admin/catering`, `/admin/orders`, `/admin/customers` etc. — a much
  // larger, unrelated pile of reads that, done inline, would serialize
  // onto PGlite's one connection ahead of the response and is what left
  // the Save button stuck on "Saving…". Neither of these two paths is
  // ever read by `/admin/settings` itself, so deferring them costs this
  // page nothing — nothing here navigates straight to `/admin/catering`
  // or bare `/admin` right after a catering-settings save the way the
  // storefront flow above does.
  if (!isTestEnv()) {
    after(() => {
      revalidatePath("/admin/catering");
      revalidatePath("/admin");
    });
  }
  return { ok: true, savedAt: new Date().toISOString() };
}
