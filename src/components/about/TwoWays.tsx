"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { ways } from "@/data/menu";

type Side = (typeof ways)[number]["id"];

/**
 * The story page opens split down the middle, one founder either side.
 *
 * They never settled the argument about what goes on the slider, so both
 * answers went on the menu — which makes the split the page's thesis rather
 * than a layout. Taking a side re-weights the grid 70/30 and slides the seam
 * with it; the half you didn't pick steps back instead of leaving, because the
 * point is that both are still on the board.
 *
 * On a phone the two halves stack and the seam has nowhere to be, so it isn't
 * drawn — see `.cne-seam` in counter.css.
 */

/** The Otter checkbox labels read "Add Lettuce"; the panel just names it. */
const topping = (tap: string) => tap.replace(/^Add /, "");

const SIDES = [
  {
    id: "chris" as const,
    heading: ["CHRIS’S", "WAY"],
    who: "Founder, and the one who moved",
    // Placeholder, written in his voice — Chris still has to confirm it.
    quote: "If you’re going to put something on it, make it do work. Raw onion does work.",
  },
  {
    id: "eddy" as const,
    heading: ["EDDY’S", "WAY"],
    who: "Founder, and the one who called",
    // Placeholder, written in his voice — Eddy still has to confirm it.
    quote: "Two things. You spent nine months on the patty — let people taste it.",
  },
];

export function TwoWays() {
  const [picked, setPicked] = useState<Side | null>(null);

  const weight = (side: Side) => (picked === null ? "1fr" : picked === side ? "70fr" : "30fr");
  const style = {
    "--sp-l": weight("chris"),
    "--sp-r": weight("eddy"),
    "--sp-seam": picked === null ? "50%" : picked === "chris" ? "70%" : "30%",
  } as CSSProperties;

  return (
    <>
      {/* These two lines used to be `<h2>`s, which put two headings above the
          page's `<h1>` — the seam line in `StorySeam`, which is the story and
          the thing the page should be found for. They are the labels on a pair
          of buttons, not sections of the document, so they are now plain
          elements and the h1 is the first heading on the page.

          Their type is set by `.cne-side .cne-side-h` in counter.css, next to
          the rest of `.cne-side`. */}
      <section className="cne-split cne-rv" aria-label="The two Ways" style={style}>
        {SIDES.map((side) => {
          const taps = ways.find((w) => w.id === side.id)?.taps ?? [];
          return (
            <button
              key={side.id}
              type="button"
              className={`cne-side is-${side.id}${
                picked !== null && picked !== side.id ? " is-off" : ""
              }`}
              aria-pressed={picked === side.id}
              onClick={() => setPicked((p) => (p === side.id ? null : side.id))}
            >
              <div className="cne-side-h">
                {side.heading[0]}
                <br />
                {side.heading[1]}
              </div>
              <div className="cne-side-who">{side.who}</div>
              <div className="cne-taps">
                {taps.map((tap) => (
                  <span key={tap}>{topping(tap)}</span>
                ))}
              </div>
              <p className="cne-side-q">&ldquo;{side.quote}&rdquo;</p>
              <div className="cne-side-pick">Take his side</div>
            </button>
          );
        })}

        <div className="cne-seam" aria-hidden="true">
          <span>Best friends since 13</span>
        </div>
      </section>

      <div className="cne-evenbar">
        <button type="button" onClick={() => setPicked(null)}>
          &larr; Back to even
        </button>
      </div>
    </>
  );
}
