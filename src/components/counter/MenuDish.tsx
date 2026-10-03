"use client";

import type { CSSProperties } from "react";
import { photoFor, type MenuItem, type WayId } from "@/data/menu";
import { FEATURED_OTTER_IDS } from "@/data/featured";
import { formatPrice } from "@/lib/otter";
import { menuCardSrcSet, menuPhotoVersion } from "@/lib/menuPhoto";
import { PattyDots } from "./PattyDots";

const LADDER_SIZES = "(min-width: 600px) 420px, 52vw";
/**
 * The cards sit in auto-fit grids whose column count depends on how many
 * cards a section has, so their width is only known after layout. Every card
 * photo is lazy, which is what lets `auto` use that real width (Chrome and
 * Edge); Safari skips `auto` and takes the estimate after it.
 */
const CARD_SIZES = "auto, (min-width: 901px) 320px, (min-width: 600px) 30vw, 50vw";
const ladderSet = (base: string, ext: string) =>
  [480, 720, 900].map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");

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
  way,
  ladder,
  onOpen,
}: {
  item: MenuItem;
  lead?: boolean;
  /** Position in its grid, for the scroll-in stagger. */
  index?: number;
  /** The Way picked on the menu: an item shot both ways shows that one. */
  way?: WayId;
  /** A bigger photo for a lead card than the item's own card cut: the base
   * path of a 480/720/900px AVIF and WebP ladder (`<ladder>-<w>.<ext>`). */
  ladder?: string;
  onOpen: (item: MenuItem) => void;
}) {
  const mostOrdered = item.otterId === FEATURED_OTTER_IDS[0];
  const photo = photoFor(item, way);
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
        {ladder ? (
          <picture>
            <source type="image/avif" srcSet={ladderSet(ladder, "avif")} sizes={LADDER_SIZES} />
            <source type="image/webp" srcSet={ladderSet(ladder, "webp")} sizes={LADDER_SIZES} />
            <img
              src={`${ladder}-480.webp`}
              alt={item.name}
              width={900}
              height={675}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : (
          photo && (
            <picture>
              <source type="image/avif" srcSet={menuCardSrcSet(photo, "avif")} sizes={CARD_SIZES} />
              <img
                src={`/menu/${photo}-card.webp${menuPhotoVersion(photo)}`}
                srcSet={menuCardSrcSet(photo, "webp")}
                sizes={CARD_SIZES}
                alt={item.name}
                width={560}
                height={420}
                loading="lazy"
                decoding="async"
              />
            </picture>
          )
        )}
      </span>
      <span className="cne-dish-body">
        <span className="n">{item.name}</span>
        <PattyDots id={item.id} />
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
