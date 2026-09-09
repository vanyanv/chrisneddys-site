"use client";

import { useEffect, useState } from "react";
import { locations } from "@/data/locations";
import { storeStatus, type StoreStatus } from "@/lib/hours";

/**
 * One store's open/closed state, kept live.
 *
 * `storeStatus` resolves to the Los Angeles hour and minute, so every label and
 * countdown it produces changes on a minute boundary and nowhere else. A plain
 * 60s interval from mount lands the refresh at an arbitrary offset inside the
 * minute, which leaves "closes in 3 min" on screen for up to 59 seconds after
 * it became 2 — and delays the flip to LAST CALL, or to closed, by the same
 * amount. Each tick schedules the next one at the top of the minute instead.
 *
 * Null until mounted. The site is a static export, so the server has no idea
 * what time it is when the page is built; rendering a status during SSR would
 * be a hydration mismatch and a guess.
 */
export function useStoreStatus(locationId = "hollywood"): StoreStatus | null {
  const [status, setStatus] = useState<StoreStatus | null>(null);

  useEffect(() => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      setStatus(storeStatus(loc));
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
  }, [locationId]);

  return status;
}
