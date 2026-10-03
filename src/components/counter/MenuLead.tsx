"use client";

import { photoFor, type MenuItem, type WayId } from "@/data/menu";
import { formatPrice } from "@/lib/otter";

const CUTS = [480, 720, 900];
const SIZES = "(min-width: 901px) 44vw, (min-width: 600px) 52vw, 100vw";

/**
 * The card the menu opens with (issue #227): 2 Sliders and Fries, the most
 * ordered item, as the big card at the top of the Combos section, which is
 * the first section. Someone who lands on the menu sees what to get first.
 *
 * The photo is the owner's studio shot of the combo, cut 16:10 so the fries
 * and both sliders fill the frame, and it follows the Way picked like the
 * combo cards do (`public/photos/<photo>-16x10-<w>`). It is the menu's
 * Largest Contentful Paint on a phone, so it loads eagerly at high priority
 * and comes in AVIF first (cuts made by `scripts/build-menu-cards.mjs`).
 */
export function MenuLead({
  item,
  way,
  onOpen,
}: {
  item: MenuItem;
  way?: WayId;
  onOpen: (item: MenuItem) => void;
}) {
  const base = `/photos/${photoFor(item, way)}-16x10`;
  const srcSet = (ext: string) => CUTS.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <div className="cne-lead">
      <button
        type="button"
        className="cne-lead-card"
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
      >
        <span className="cne-dish-most" aria-hidden="true">
          MOST ORDERED
        </span>
        <span className="cne-lead-ph">
          <picture>
            <source type="image/avif" srcSet={srcSet("avif")} sizes={SIZES} />
            <source type="image/webp" srcSet={srcSet("webp")} sizes={SIZES} />
            <img
              src={`${base}-720.webp`}
              alt={item.name}
              width={900}
              height={563}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </span>
        <span className="cne-lead-body">
          <span className="n">{item.name}</span>
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
