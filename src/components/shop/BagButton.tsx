"use client";

import { useEffect, useRef, useState } from "react";
import { bagCount, hydrateBag, openBag, useBag } from "./bagStore";

/**
 * The bag button in the site header.
 *
 * Three rules, and they are the whole design:
 *
 *  1. It never replaces ORDER ONLINE. That button is the food business's front
 *     door and it points at the Otter storefront; swapping it for a bag inside
 *     /shop would take the burger button away from someone who came for a
 *     burger, and a nav control that means different things on different pages
 *     is one people stop trusting.
 *  2. It only exists when it is true. No bag icon until there is something in
 *     the bag — and then it stays on every page of the site, not just the shop,
 *     so wandering off to the menu does not lose it. Empty it and it leaves.
 *  3. The count is items, not lines. Two caps reads 2.
 *
 * The slot wrapper is always rendered even when the button is not, because
 * `flyToBag` needs somewhere to mount its measuring ghost on the very first add.
 */
export function BagButton() {
  const { lines } = useBag();
  const count = bagCount(lines);

  // The store deliberately starts empty on both sides of hydration; this is the
  // effect that fills it in. See the note in bagStore.ts.
  useEffect(() => {
    hydrateBag();
  }, []);

  const previous = useRef(0);
  const [entrance, setEntrance] = useState<"new" | "bump" | null>(null);

  useEffect(() => {
    const was = previous.current;
    previous.current = count;
    if (count === 0 || count === was) return;
    // 0 → n is an arrival and can afford to be loud, because it happens once.
    // n → m is a nudge. Clearing first lets the same class replay back to back.
    setEntrance(null);
    const id = requestAnimationFrame(() => setEntrance(was === 0 ? "new" : "bump"));
    return () => cancelAnimationFrame(id);
  }, [count]);

  return (
    <span className="cne-bag-slot" id="cne-bag-slot">
      {count > 0 && (
        <button
          id="cne-bag-btn"
          type="button"
          className={`cne-bagbtn${entrance ? ` is-${entrance}` : ""}`}
          onClick={openBag}
          onAnimationEnd={() => setEntrance(null)}
          aria-haspopup="dialog"
          aria-label={`Open bag — ${count} ${count === 1 ? "item" : "items"}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M4 7h16l-1.4 13.2a1 1 0 0 1-1 .8H6.4a1 1 0 0 1-1-.8L4 7Z" />
            <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" />
          </svg>
          <span className="cne-bagbtn-t">BAG</span>
          {/* Keyed on the count so React remounts the digit and the roll replays. */}
          <span className="cne-bagbtn-c">
            <span key={count}>{count}</span>
          </span>
        </button>
      )}
    </span>
  );
}
