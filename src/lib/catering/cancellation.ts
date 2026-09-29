/**
 * Cancellation refund tiers: free 48h+ out, half back 24–48h out, nothing
 * inside 24h.
 */
import type { CancellationQuote, CancellationTier } from "./types";

const FREE_HOURS = 48;
const HALF_HOURS = 24;

function hoursUntil(eventMs: number, nowMs: number): number {
  return (eventMs - nowMs) / (60 * 60 * 1000);
}

export function cancellationTier(eventMs: number, nowMs: number): CancellationTier {
  const hours = hoursUntil(eventMs, nowMs);
  if (hours >= FREE_HOURS) return "free";
  if (hours >= HALF_HOURS) return "half";
  return "none";
}

/** The refund for cancelling `totalCents` now, given the event's scheduled time. */
export function refundForCancel(
  totalCents: number,
  eventMs: number,
  nowMs: number,
): CancellationQuote {
  const tier = cancellationTier(eventMs, nowMs);
  const refundCents =
    tier === "free" ? totalCents : tier === "half" ? Math.round(totalCents / 2) : 0;
  return { tier, refundCents };
}
