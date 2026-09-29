"use server";

/** Server actions for `/admin/catering/[id]/` — every one a thin
 * `requireOwner()` + a call into `src/lib/catering/service.ts` (phase 3),
 * which does the real work (status transition, Stripe capture/cancel,
 * `catering_events` row, email) and returns `{ok:true} | {ok:false, error}`.
 * This file only shapes `FormData` into that call — same division of
 * labour as `../orders/[id]/actions.ts`.
 *
 * Deliberately calls no `revalidatePath` at all, matching that same
 * `orders/[id]/actions.ts`: an earlier version revalidated this page
 * inline, on the theory that only *this* page's own read was cheap enough
 * to do synchronously and the risk was rippling out to `/admin/catering`
 * and `/admin`. In practice PGlite allows exactly one query at a time for
 * the whole server, and the e2e suite runs `catering-phone` and
 * `catering-desktop` in parallel against that one server — so an inline
 * `revalidatePath` here, which makes Next re-render this very page (another
 * DB read) before the action's response can resolve, could still queue
 * behind a concurrent request's own DB work and hang the action forever
 * (the "Approve & charge" button stuck on "Approving…" indefinitely). This
 * is the same class of bug a deferred `revalidatePath("/admin/settings")`
 * caused for the catering settings toggle (`../settingsActions.ts`) — the
 * fix there was to stop revalidating inline; the fix here is the same,
 * taken one step further: the callers (`OrderActionsPanel`,
 * `ChangeReviewPanel`, `NoteForm`) each call `router.refresh()`
 * client-side once their action finishes without an error
 * (`useRefreshOnSuccess`), which is a separate request issued after the
 * action has already returned rather than work packed into its response,
 * so it can queue behind other PGlite work instead of deadlocking it.
 */
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
  return {};
}

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
  return {};
}
