"use server";

/** Server actions for `/admin/catering/[id]/` — every one a thin
 * `requireOwner()` + a call into `src/lib/catering/service.ts` (phase 3),
 * which does the real work (status transition, Stripe capture/cancel,
 * `catering_events` row, email) and returns `{ok:true} | {ok:false, error}`.
 * This file only shapes `FormData` into that call and revalidates the
 * pages that show the result — same division of labour as
 * `../orders/[id]/actions.ts`. */
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getDb } from "@/db/client";
import {
  approveChange,
  approveOrder,
  declineChange,
  declineOrder,
  markCompleted,
  addNote,
} from "@/lib/catering/service";

export type CateringActionState = { error?: string };

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * `/admin/catering/${id}` — the page these actions are called from — is
 * revalidated INLINE, not deferred: the pill, the timeline and every other
 * piece of `order.status`-derived UI on that page live in the Server
 * Component (`page.tsx`), not in `OrderActionsPanel`/`ChangeReviewPanel`'s
 * own local state, so they only ever update from a fresh RSC render riding
 * back on the action's own response. `revalidatePath` during a Server
 * Action is what makes Next render that fresh payload for *this* page
 * before the action resolves (it marks `workStore.pathWasRevalidated`,
 * which the action handler checks right after the action returns) — skip
 * it here and the response carries back Next's stale, pre-action render
 * instead, which would silently snap "BOOKED"/"DECLINED" back to
 * "REQUESTED" the instant the action resolved, the same class of bug a
 * deferred `revalidatePath("/admin/settings")` caused for the catering
 * settings toggle (`../settingsActions.ts`). This page reads just the one
 * order plus a handful of small lookups, so revalidating it inline is
 * cheap on its own — the risk in the settings fix was never revalidating
 * *this* page, only rippling out to `/admin` (below).
 *
 * `/admin/catering` (the list) and `/admin` (the shared layout) ARE
 * deferred to `after()`: revalidating the shared `/admin` layout invalidates
 * and re-triggers the admin nav's own `<Link>` prefetches to
 * `/admin/orders`, `/admin/customers` etc. — a much larger, unrelated pile
 * of reads that, done inline, would serialize onto PGlite's one connection
 * ahead of the response and is what hung the button here in the first
 * place. Neither path is ever read by `/admin/catering/${id}` itself, so
 * deferring them costs this page nothing.
 */
function revalidateOrder(id: string) {
  revalidatePath(`/admin/catering/${id}`);
  if (isTestEnv()) return;
  after(() => {
    revalidatePath("/admin/catering");
    revalidatePath("/admin");
  });
}

export async function approveOrderAction(
  _prevState: CateringActionState | undefined,
  formData: FormData,
): Promise<CateringActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const db = await getDb();
  const result = await approveOrder(db, orderId);
  if (!result.ok) return { error: result.error };
  revalidateOrder(orderId);
  return {};
}

export const DECLINE_REASONS = [
  "Closed that day",
  "Too big for that time",
  "Too far",
  "Other",
] as const;

export async function declineOrderAction(
  _prevState: CateringActionState | undefined,
  formData: FormData,
): Promise<CateringActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  const reasonKind = String(formData.get("reasonKind") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (!orderId) return { error: "Missing order id." };
  if (!reasonKind) return { error: "Choose a reason." };

  const reason = message ? `${reasonKind} — ${message}` : reasonKind;

  const db = await getDb();
  const result = await declineOrder(db, orderId, reason);
  if (!result.ok) return { error: result.error };
  revalidateOrder(orderId);
  return {};
}

export async function approveChangeAction(
  _prevState: CateringActionState | undefined,
  formData: FormData,
): Promise<CateringActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const db = await getDb();
  const result = await approveChange(db, orderId);
  if (!result.ok) return { error: result.error };
  revalidateOrder(orderId);
  return {};
}

export async function declineChangeAction(
  _prevState: CateringActionState | undefined,
  formData: FormData,
): Promise<CateringActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!orderId) return { error: "Missing order id." };

  const db = await getDb();
  const result = await declineChange(db, orderId, reason || undefined);
  if (!result.ok) return { error: result.error };
  revalidateOrder(orderId);
  return {};
}

export async function markCompletedAction(
  _prevState: CateringActionState | undefined,
  formData: FormData,
): Promise<CateringActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const db = await getDb();
  const result = await markCompleted(db, orderId);
  if (!result.ok) return { error: result.error };
  revalidateOrder(orderId);
  return {};
}

export async function addNoteAction(
  _prevState: CateringActionState | undefined,
  formData: FormData,
): Promise<CateringActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!orderId) return { error: "Missing order id." };
  if (!text) return { error: "Write a note first." };

  const db = await getDb();
  await addNote(db, orderId, text);
  revalidateOrder(orderId);
  return {};
}
