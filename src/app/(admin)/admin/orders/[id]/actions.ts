"use server";

import { markPickedUp, markReadyForPickup, markRefunded, markShipped } from "@/lib/ordersAdmin";

export type FulfilmentActionState = { error?: string };

export async function markShippedAction(
  _prevState: FulfilmentActionState | undefined,
  formData: FormData,
): Promise<FulfilmentActionState> {
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
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const result = await markReadyForPickup(orderId);
  return result.ok ? {} : { error: result.error };
}

export async function markPickedUpAction(
  _prevState: FulfilmentActionState | undefined,
  formData: FormData,
): Promise<FulfilmentActionState> {
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
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Missing order id." };

  const result = await markRefunded(orderId);
  return result.ok ? {} : { error: result.error };
}
