"use client";

import { useEffect, useState } from "react";
import { locations } from "@/data/locations";
import { storeStatus } from "@/lib/hours";

/**
 * The yellow banner that drops in for the last 45 minutes of service. It is
 * absent the rest of the time rather than dimmed, so its presence is the signal.
 */
export function LastCall() {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const loc = locations.find((l) => l.id === "hollywood");
    if (!loc) return;
    const tick = () => {
      const s = storeStatus(loc);
      setMinutes(s.state === "last-call" ? s.minutesLeft : null);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (minutes === null) return null;
  return (
    <div className="cne-lastcall" role="status">
      <i aria-hidden="true" />
      Last call — kitchen closes in {minutes} min
    </div>
  );
}
