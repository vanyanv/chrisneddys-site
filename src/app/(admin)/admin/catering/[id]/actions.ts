"use server";

/** Server actions for `/admin/catering/[id]/` — every one a thin
 * `requireOwner()` + a call into `src/lib/catering/service.ts` (phase 3),
 * which does the real work (status transition, Stripe capture/cancel,
 * `catering_events` row, email) and returns `{ok:true} | {ok:false, error}`.
 * This file only shapes `FormData` into that call and revalidates the
 * pages that show the result — same division of labour as
 * `../orders/[id]/actions.ts`. */
import { revalidatePath } from "next/cache";
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

function revalidateOrder(id: string) {
  revalidatePath(`/admin/catering/${id}`);
  revalidatePath("/admin/catering");
  revalidatePath("/admin");
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
