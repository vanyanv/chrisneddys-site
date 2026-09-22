import type { CSSProperties } from "react";
import "@/styles/drip-edge.css";

/**
 * Idea 3. A row of irregular paint drips hanging off the bottom edge of a
 * colored section — the black block on the "My Ambitions as a Slider" wall.
 * Server component: the drip layout is a pure function of `seed`, so it
 * renders identically on the server and the client with no hydration risk.
 */

/** Deterministic PRNG so the same `seed` draws the same drips every render
 * (mulberry32 — small, fast, good enough for decoration). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WIDTH = 800;
const BASE = 40;

type FillStyle = CSSProperties & { fill?: string };

function dripPath(seed: number) {
  const rand = mulberry32(seed);
  const count = 8 + Math.floor(rand() * 3);
  const gap = WIDTH / count;
  const drips: Array<[number, number, number]> = [];
  for (let i = 0; i < count; i++) {
    const x = gap * i + gap * 0.5 + (rand() - 0.5) * gap * 0.4;
    const len = 24 + rand() * 62;
    const w = 6 + rand() * 5;
    drips.push([x, len, w]);
  }
  let d = `M0,0 H${WIDTH} V${BASE} `;
  for (let i = drips.length - 1; i >= 0; i--) {
    const drip = drips[i];
    if (!drip) continue;
    const [x, len, w] = drip;
    d += `L${x + w},${BASE} C${x + w},${BASE + len * 0.6} ${x + w + 1},${BASE + len} ${x},${BASE + len + w * 0.3} C${x - w - 1},${BASE + len} ${x - w},${BASE + len * 0.6} ${x - w},${BASE} `;
  }
  d += `L0,${BASE} Z`;
  return d;
}

export function DripEdge({
  color,
  seed = 1,
  className,
}: {
  /** CSS color, matched to the section this hangs from — e.g. `var(--color-cne-red)`. */
  color: string;
  /** Varies the drip layout so repeated instances don't look identical. */
  seed?: number;
  className?: string;
}) {
  const d = dripPath(seed);
  const fillStyle: FillStyle = { fill: color };
  return (
    <div className={["cne-dripedge", className].filter(Boolean).join(" ")} aria-hidden="true">
      <svg viewBox={`0 0 ${WIDTH} 140`} preserveAspectRatio="none" focusable="false">
        <path d={d} style={fillStyle} />
      </svg>
    </div>
  );
}
