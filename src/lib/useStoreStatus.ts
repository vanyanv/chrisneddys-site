"use client";

import { useEffect, useState } from "react";
import { locations, type Location } from "@/data/locations";
import { storeStatus, type StoreStatus } from "@/lib/hours";

/**
 * Re-runs `compute(loc, now)` on the minute boundary, for `locationId`, and
 * keeps the latest result in state. Shared by `useStoreStatus` and
 * `useLateHour` so there is exactly one timer per mounted location, not one
 * per hook — both read the same clock, they just fold it differently.
 *
 * `compute` is expected to be a stable, module-level function (like
 * `storeStatus` or `lateHourState`), not a fresh closure per render: it is
 * intentionally left out of the effect's dependency array, since a new
 * identity every render would otherwise restart the timer every render.
 *
 * `storeStatus` resolves to the Los Angeles hour and minute, so every label and
 * countdown it produces changes on a minute boundary and nowhere else. A plain
 * 60s interval from mount lands the refresh at an arbitrary offset inside the
 * minute, which leaves "closes in 3 min" on screen for up to 59 seconds after
 * it became 2 — and delays the flip to LAST CALL, or to closed, by the same
 * amount. Each tick schedules the next one at the top of the minute instead.
 *
 * Null until mounted. The site is a static export, so the server has no idea
 * what time it is when the page is built; rendering a live result during SSR
 * would be a hydration mismatch and a guess.
 */
export function useMinuteTick<T>(
  locationId: string,
  compute: (loc: Location, now: Date) => T,
): T | null {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      setValue(compute(loc, new Date()));
      // Timers are allowed to fire a hair early; the floor stops that from
      // turning into a spin at the boundary.
      timer = setTimeout(tick, Math.max(60_000 - (Date.now() % 60_000), 1_000));
    };

    // A backgrounded tab has its timers throttled, so a tab left open through
    // closing time comes back showing the old status. Catch up on return.
    const onVisible = () => {
      if (!document.hidden) tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return value;
}

/** One store's open/closed state, kept live. See `useMinuteTick`. */
export function useStoreStatus(locationId = "hollywood"): StoreStatus | null {
  return useMinuteTick(locationId, storeStatus);
}
