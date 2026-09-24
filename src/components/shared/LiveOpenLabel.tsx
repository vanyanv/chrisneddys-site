"use client";

import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * A plain-words open/closed label for a store that is trading, kept in step
 * with the status tag beside it. The page is static, so until the clock is
 * known (and for anyone without script) it says "Open daily", which is true at
 * any hour — a hard-coded "Open now" sat above "CLOSED · OPENS 10 AM" at 4 AM.
 */
export function LiveOpenLabel({
  locationId,
  suffix = "",
}: {
  locationId: string;
  /** Appended as-is, e.g. " →" on a link card. */
  suffix?: string;
}) {
  const status = useStoreStatus(locationId);
  const label =
    status?.state === "open"
      ? "Open now"
      : status?.state === "last-call"
        ? "Last call"
        : status?.state === "closed"
          ? "Closed now"
          : "Open daily";

  return (
    <>
      {label}
      {suffix}
    </>
  );
}
