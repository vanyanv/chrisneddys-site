"use client";

import { useEffect, useState } from "react";
import { formatDuration, formatTimeLA, pick, type Lang } from "@/lib/closing/crewText";

/** "Open. Store closes at 1:00 AM (42m)." — red inside the last 10 minutes and after close. */
export function OpenBanner({
  closesAtMs,
  endsAtMs,
  serverNowMs,
  lang,
}: {
  closesAtMs: number;
  endsAtMs: number;
  serverNowMs: number;
  lang: Lang;
}) {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    const offset = serverNowMs - Date.now();
    const id = setInterval(() => setNow(Date.now() + offset), 15000);
    return () => clearInterval(id);
  }, [serverNowMs]);

  const closes = formatTimeLA(new Date(closesAtMs));
  if (now <= closesAtMs) {
    const left = closesAtMs - now;
    const t = formatDuration(left, false);
    return (
      <div className={`cl-banner ${left <= 10 * 60_000 ? "cl-banner-closing" : "cl-banner-open"}`}>
        {pick(
          lang,
          `Open. Store closes at ${closes} (${t}).`,
          `Abierta. La tienda cierra a las ${closes} (${t}).`,
        )}
      </div>
    );
  }
  const ends = formatTimeLA(new Date(endsAtMs));
  return (
    <div className="cl-banner cl-banner-closing">
      {pick(
        lang,
        `Past close. You can still send until ${ends}.`,
        `Ya cerró. Puedes enviar hasta las ${ends}.`,
      )}
    </div>
  );
}
