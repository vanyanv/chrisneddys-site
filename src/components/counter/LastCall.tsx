"use client";

import type { CSSProperties } from "react";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The yellow banner that drops in for the last 45 minutes of service. It is
 * absent the rest of the time rather than dimmed, so its presence is the signal.
 *
 * The monster at its start (idea 10) has its own movable iris group painted
 * over the shared `cne-classic` symbol's built-in eye — the same trick as the
 * home page's pointer-tracking hero monster — so `.cne-lc-dart` in
 * `chrome-art.css` can flick just the iris side to side, watching the clock,
 * without touching the symbol itself.
 */
export function LastCall() {
  const status = useStoreStatus("hollywood");
  if (status?.state !== "last-call") return null;

  return (
    <div className="cne-lastcall" role="status">
      <svg
        className="cne-lc-mon"
        width={30}
        height={30}
        viewBox="0 0 200 200"
        style={{ "--m-body": "#e63027" } as CSSProperties}
        aria-hidden="true"
      >
        <use href="#cne-classic" />
        <circle cx={100} cy={76} r={30} fill="#fff8e7" />
        <g className="cne-lc-dart">
          <circle cx={100} cy={76} r={16} fill="#2e5fd9" />
          <circle cx={100} cy={76} r={7} fill="#14110d" />
        </g>
        <circle cx={100} cy={76} r={33} fill="none" stroke="#14110d" strokeWidth={6} />
      </svg>
      <i aria-hidden="true" />
      Last call — kitchen closes in {status.minutesLeft} min
    </div>
  );
}
