"use client";

import { useMemo } from "react";
import { Monster } from "@/components/mascots/Monster";
import { useViewedLocation } from "@/lib/useViewedLocation";
import { useLateHour } from "@/lib/useLateHour";
import { numberScrawl, seedFromId } from "@/lib/numbersScrawl";

const FOOT_NUMBER_COUNT = 20;

/**
 * The footer's corner monster, plus the hallway scrawl behind it.
 *
 * Idea 23: it sleeps when the store the visitor is looking at does, and
 * wakes with it — the same location the header's clock reads
 * (`useViewedLocation`), so a Van Nuys visitor sees Van Nuys' clock down
 * here too. The server render always draws it awake (`species="classic"`):
 * the server has no idea what time it is, and guessing asleep would be a
 * hydration mismatch for every visitor who lands while the store is open.
 *
 * Idea 44: from 10 PM until close, this already-dark corner (the footer's
 * ink background, per `chrome-art.css`) gets the same treatment as the
 * Open late section — the hallway's number scrawl shows up behind the
 * content at 30% opacity. The monster's pupil glows at every hour, as it
 * always has on this dark surface; outside that window the scrawl does not
 * render at all, so nothing here differs from today except during the
 * blacklight hour.
 */
export function FooterMonster() {
  const { loc } = useViewedLocation();
  const state = useLateHour(loc.id);
  const blacklight = state?.blacklight ?? false;

  const numbers = useMemo(() => numberScrawl(seedFromId(loc.id), FOOT_NUMBER_COUNT), [loc.id]);

  return (
    <>
      {blacklight && (
        <svg
          className="cne-foot-numbers"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          {numbers.map((n, idx) => (
            <text
              key={idx}
              x={n.x}
              y={n.y}
              transform={`rotate(${n.rot} ${n.x} ${n.y})`}
              style={{ fontSize: `${n.scale}em` }}
            >
              {n.text}
            </text>
          ))}
        </svg>
      )}
      <Monster
        species={state?.closed ? "classic-sleep" : "classic"}
        bodyColor="#3ee06a"
        irisColor="#2fb8ff"
        pupilColor="#ff3b3b"
        glowColor="#ff3b3b"
        size={52}
        className="cne-foot-monster"
      />
    </>
  );
}
