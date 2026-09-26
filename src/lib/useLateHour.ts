"use client";

import type { Location } from "@/data/locations";
import { losAngelesNow, storeStatus } from "@/lib/hours";
import { useMinuteTick } from "@/lib/useStoreStatus";

export type LateHourState = {
  /** The store is not serving right now (idea 23: monsters sleep when the
   * store does). */
  closed: boolean;
  /** From 10 PM Los Angeles time until close (idea 44: the blacklight
   * hour) — the one stretch where the Open late section and the footer are
   * allowed to look like the hallway under blacklight rather than daylight. */
  blacklight: boolean;
};

/** 10 PM: where the blacklight hour starts. */
const BLACKLIGHT_FROM_HOUR = 22;
/**
 * 6 AM: where it has certainly ended. Every store's kitchen shuts by 2 AM
 * (`src/data/locations.ts`), so this only ever matters for the after-midnight
 * stretch of a window that opened the evening before — it is not a claim
 * about how late any store actually stays open.
 */
const BLACKLIGHT_UNTIL_HOUR = 6;

/**
 * The pure decision, from a location and a moment in time: is the store
 * asleep, and is it inside the blacklight hour. Kept apart from `storeStatus`
 * because neither "closed" nor "blacklight" is a store status in its own
 * right — they are both readings of one, taken together so the sleeping
 * monster and the blacklight scrawl never answer from two different clocks.
 */
export function lateHourState(loc: Location, at: Date = new Date()): LateHourState {
  const status = storeStatus(loc, at);
  const serving = status.state === "open" || status.state === "last-call";
  const hour = Math.floor(losAngelesNow(at).minutes / 60);
  return {
    closed: !serving,
    blacklight: serving && (hour >= BLACKLIGHT_FROM_HOUR || hour < BLACKLIGHT_UNTIL_HOUR),
  };
}

/** `lateHourState`, kept live. Null until mounted (see `useMinuteTick`). */
export function useLateHour(locationId = "hollywood"): LateHourState | null {
  return useMinuteTick(locationId, lateHourState);
}
