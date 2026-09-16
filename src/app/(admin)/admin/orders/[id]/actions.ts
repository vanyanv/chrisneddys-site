"use server";

import { requireOwner } from "@/lib/auth";
import { markPickedUp, markReadyForPickup, markRefunded, markShipped } from "@/lib/ordersAdmin";

export type FulfilmentActionState = { error?: string };

export async function markShippedAction(
  _prevState: FulfilmentActionState | undefined,
  formData: FormData,
): Promise<FulfilmentActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  const carrier = String(formData.get("carrier") ?? "");
  const trackingNumber = String(formData.get("trackingNumber") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const result = await markShipped(orderId, { carrier, trackingNumber });
  return result.ok ? {} : { error: result.error };
}

export async function markReadyAction(
  _prevState: FulfilmentActionState | undefined,
  formData: FormData,
): Promise<FulfilmentActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const result = await markReadyForPickup(orderId);
  return result.ok ? {} : { error: result.error };
}

export async function markPickedUpAction(
  _prevState: FulfilmentActionState | undefined,
  formData: FormData,
): Promise<FulfilmentActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const result = await markPickedUp(orderId);
  return result.ok ? {} : { error: result.error };
}

export type RefundActionState = { error?: string };

export async function markRefundedAction(
  _prevState: RefundActionState | undefined,
  formData: FormData,
): Promise<RefundActionState> {
  await requireOwner();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  // An unchecked checkbox sends no `release` entry at all — `has` (not a
  // value comparison) is what makes the toggle's off-by-default behaviour
  // hold even if a form is ever submitted without JS.
  const release = formData.has("release");
  const reason = String(formData.get("reason") ?? "").trim();

  const result = await markRefunded(orderId, { release, reason: reason || undefined });
  return result.ok ? {} : { error: result.error };
}
