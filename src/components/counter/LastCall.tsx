"use client";

import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The yellow banner that drops in for the last 45 minutes of service. It is
 * absent the rest of the time rather than dimmed, so its presence is the signal.
 */
export function LastCall() {
  const status = useStoreStatus("hollywood");
  if (status?.state !== "last-call") return null;

  return (
    <div className="cne-lastcall" role="status">
      <i aria-hidden="true" />
      Last call — kitchen closes in {status.minutesLeft} min
    </div>
  );
}
