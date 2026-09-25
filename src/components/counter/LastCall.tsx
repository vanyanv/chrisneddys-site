"use client";

import type { CSSProperties } from "react";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import { MonsterEye } from "@/components/mascots/MonsterEye";
import { useStoreStatus } from "@/lib/useStoreStatus";

const { body: BODY, iris: IRIS } = MONSTER_COLORS.red;

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
        style={{ "--m-body": BODY, "--m-iris": IRIS } as CSSProperties}
        aria-hidden="true"
      >
        <use href="#cne-classic-red" />
        <MonsterEye body={BODY} iris={IRIS} className="cne-lc-dart" />
      </svg>
      <i aria-hidden="true" />
      Last call — kitchen closes in {status.minutesLeft} min
    </div>
  );
}
