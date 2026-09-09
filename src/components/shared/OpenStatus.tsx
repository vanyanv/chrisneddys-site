"use client";

import { statusLabel } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

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
  const status = useStoreStatus(locationId);

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
