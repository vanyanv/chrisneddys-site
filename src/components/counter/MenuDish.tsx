"use client";

import type { CSSProperties } from "react";
import type { MenuItem } from "@/data/menu";
import { FEATURED_OTTER_IDS } from "@/data/featured";
import { formatPrice } from "@/lib/otter";

/**
 * One menu item as a photo card (issue #206): the food on top, cropped tight
 * by `scripts/build-menu-cards.mjs` so it fills the frame, then the name and
 * price.
 *
 * `lead` is the wide card a section opens with — the photo beside the name,
 * the description and PICK YOURS. On a phone the other cards drop the
 * description; the sheet every card opens carries it in full.
 *
 * A button, like the list rows it replaced: it opens the item sheet, which
 * carries the Way through to the Otter handoff.
 */
export function MenuDish({
  item,
  lead,
  index = 0,
  onOpen,
}: {
  item: MenuItem;
  lead?: boolean;
  /** Position in its grid, for the scroll-in stagger. */
  index?: number;
  onOpen: (item: MenuItem) => void;
}) {
  const mostOrdered = item.otterId === FEATURED_OTTER_IDS[0];
  return (
    <button
      type="button"
      className={`cne-dish${lead ? " is-lead" : ""}`}
      onClick={() => onOpen(item)}
      aria-haspopup="dialog"
      style={{ "--i": Math.min(index, 5) } as CSSProperties}
    >
      {mostOrdered && (
        <span className="cne-dish-most" aria-hidden="true">
          MOST ORDERED
        </span>
      )}
      <span className="cne-dish-ph">
        {/* Every item drawn as a card has a photo (menu.test.ts). The name
            alone, as the list rows had it: the button already announces the
            description and the price. */}
        {item.photo && (
          <picture>
            <source type="image/avif" srcSet={`/menu/${item.photo}-card.avif`} />
            <img
              src={`/menu/${item.photo}-card.webp`}
              alt={item.name}
              width={560}
              height={420}
              loading="lazy"
              decoding="async"
            />
          </picture>
        )}
      </span>
      <span className="cne-dish-body">
        <span className="n">{item.name}</span>
        {item.desc && <span className="d">{item.desc}</span>}
        <span className="p">{formatPrice(item.price)}</span>
        {lead ? (
          <span className="cne-dish-cta" aria-hidden="true">
            PICK YOURS &rarr;
          </span>
        ) : (
          <span className="cne-chev" aria-hidden="true">
            ›
          </span>
        )}
      </span>
    </button>
  );
}
