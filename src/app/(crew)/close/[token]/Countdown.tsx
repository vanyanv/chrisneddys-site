"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/closing/crewText";

/**
 * Counts down to `opensAtMs` against the server's clock (the offset taken at
 * load), and refreshes the page when it gets there so the checklist appears.
 */
export function Countdown({ opensAtMs, serverNowMs }: { opensAtMs: number; serverNowMs: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(opensAtMs - serverNowMs);

  useEffect(() => {
    const offset = serverNowMs - Date.now();
    // Refresh at zero, then retry a couple of times with backoff and stop: a
    // fixed preview clock (?at=) keeps answering "before".
    const delays = [0, 3000, 10000];
    let tries = 0;
    let nextAt = 0;
    const tick = () => {
      const remaining = opensAtMs - (Date.now() + offset);
      setLeft(remaining);
      if (remaining <= 0 && tries < delays.length && Date.now() >= nextAt) {
        nextAt = Date.now() + (delays[tries + 1] ?? 0);
        tries += 1;
        router.refresh();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [opensAtMs, serverNowMs, router]);

  return (
    <div className="cl-big" aria-live="off">
      {formatDuration(left)}
    </div>
  );
}
