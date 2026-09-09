"use client";

import { useEffect, useState } from "react";
import { locations } from "@/data/locations";
import { storeStatus, statusLabel, type StoreStatus } from "@/lib/hours";

/**
 * "Are you open right now" is the question people actually arrive with, and
 * a table of hours makes them do the arithmetic — which is worse at 1 AM,
 * exactly when it matters most here.
 *
 * The site is a static export, so the server has no idea what time it is when
 * someone opens the page. The pill reserves its space in the HTML and fills in
 * on mount, which keeps the layout stable and avoids a hydration mismatch.
 */
export function OpenStatus({ locationId = "hollywood" }: { locationId?: string }) {
  const [status, setStatus] = useState<StoreStatus | null>(null);

  useEffect(() => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    const tick = () => setStatus(storeStatus(loc));
    tick();
    // A minute is enough: the only thing that moves is the countdown.
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const state = status?.state ?? "unknown";
  const tone = state === "closed" ? " is-shut" : state === "last-call" ? " is-last" : "";

  return (
    <span
      className={`cne-stat${tone}`}
      // Empty until mounted, so screen readers aren't told "" is meaningful.
      aria-hidden={status ? undefined : true}
      aria-live="polite"
    >
      <span className="cne-dot" aria-hidden="true" />
      {status ? statusLabel(status) : ""}
    </span>
  );
}
