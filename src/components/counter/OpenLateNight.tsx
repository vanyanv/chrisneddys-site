"use client";

import { useMemo, type CSSProperties } from "react";
import { closingSummary } from "@/lib/hours";
import { useLateHour } from "@/lib/useLateHour";
import { numberScrawl, seedFromId } from "@/lib/numbersScrawl";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import type { Location } from "@/data/locations";

const NIGHT_NUMBER_COUNT = 22;

/** The custom property `location-page.css` reads for the flicker stagger. */
type NumStyle = CSSProperties & { "--i"?: number };

/**
 * The "Open late" section (idea 18's number wall, idea 44's blacklight hour)
 * — only what needs the clock is a client component; `StoreDetail` still
 * decides whether the section renders at all (`loc.isOpen`).
 *
 * The number scrawl itself is static, seeded markup (`numberScrawl`) — the
 * server and the client render byte-identical `<text>`s. Only the
 * `is-blacklight` class, which brightens them from 18% to 45% opacity
 * (`location-page.css`), comes from the clock, and it defaults to off for
 * the server render and the pre-mount client render alike.
 *
 * The flicker-on itself needs no observer of its own: this section already
 * carries `cne-rv`, and `RevealRoot` adds `.is-in` to it the same way it
 * does every other section — `location-page.css` keys the numbers'
 * animation off `.cne-lp-night.is-in`.
 */
export function OpenLateNight({ loc, hood }: { loc: Location; hood: string }) {
  const state = useLateHour(loc.id);
  const blacklight = state?.blacklight ?? false;
  const numbers = useMemo(() => numberScrawl(seedFromId(loc.id), NIGHT_NUMBER_COUNT), [loc.id]);

  return (
    <section
      className={`cne-sec cne-lp-night cne-rv${blacklight ? " is-blacklight" : ""}`}
      aria-labelledby="lp-late"
    >
      <svg
        className="cne-lp-night-numbers"
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
            style={{ fontSize: `${n.scale}em`, "--i": n.i } as NumStyle}
          >
            {n.text}
          </text>
        ))}
      </svg>
      <div className="cne-lp-night-in">
        <Monster
          species="classic"
          bodyColor={MONSTER_COLORS.lime.body}
          irisColor={MONSTER_COLORS.lime.iris}
          glowColor={MONSTER_COLORS.lime.body}
          size={96}
          className="cne-lp-night-mon"
        />
        <div className="cne-eyebrow">After everyone else has closed</div>
        <h2 id="lp-late">Open late.</h2>
        <p className="cne-lede">
          We serve until {closingSummary(loc)}. Most places around {hood} are dark by ten, which is
          why so much of what we smash goes out after midnight — to people coming off a shift, out
          of a show on Sunset, or off the 101 with nowhere else still cooking.
        </p>
        <p className="cne-lede">
          The full menu runs the whole time. Nothing is pulled at midnight, and the fries are cut
          the same right up to close — {closingSummary(loc)} — as they are at noon.
        </p>
      </div>
    </section>
  );
}
