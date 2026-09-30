"use client";

import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/otter";
import { PattyDots } from "./PattyDots";

const CUTS = [480, 720, 900];
const srcSet = (ext: string) => CUTS.map((w) => `/photos/double-4x3-${w}.${ext} ${w}w`).join(", ");
const SIZES = "(min-width: 901px) 44vw, (min-width: 600px) 52vw, 100vw";

/**
 * The card the menu opens with (issue #206): the signature slider, held up
 * in a hand, before any list. Someone who lands on the menu sees what to get
 * first.
 *
 * The photo is the stacked double from the home page's structured data, the
 * one real in-hand shot the site has, standing in for this item until there
 * is a photo of the single slider held the same way. It is the menu's Largest
 * Contentful Paint on a phone, so it loads eagerly at high priority and comes
 * in AVIF first (cuts made by `scripts/build-menu-cards.mjs`).
 */
export function MenuLead({ item, onOpen }: { item: MenuItem; onOpen: (item: MenuItem) => void }) {
  return (
    <div className="cne-sec cne-lead">
      <div className="cne-lead-lbl">Asked about most</div>
      <button
        type="button"
        className="cne-lead-card"
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
      >
        <span className="cne-lead-ph">
          <picture>
            <source type="image/avif" srcSet={srcSet("avif")} sizes={SIZES} />
            <source type="image/webp" srcSet={srcSet("webp")} sizes={SIZES} />
            <img
              src="/photos/double-4x3-720.webp"
              alt=""
              width={900}
              height={675}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </span>
        <span className="cne-lead-body">
          <span className="n">{item.name}</span>
          <PattyDots id={item.id} />
          <span className="d">{item.desc}</span>
          <span className="ft">
            <span className="p">{formatPrice(item.price)}</span>
            <span className="cta" aria-hidden="true">
              PICK YOURS &rarr;
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
