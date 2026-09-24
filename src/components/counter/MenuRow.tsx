"use client";

import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/otter";
import { Monster } from "@/components/mascots/Monster";

/**
 * One menu row: photo, name, two lines of description, price, chevron.
 *
 * It's a button rather than a link because it opens the item sheet — the sheet
 * is what carries the Way you picked through to the handoff. The link out to
 * Otter lives in the sheet's footer.
 */
export function MenuRow({
  item,
  star,
  eager,
  /**
   * Name + price only, no photo tile — for a phone reading a long list (the
   * thirteen drinks) as fast as possible. The thumb still renders in the DOM
   * so desktop, which never sets this, is untouched; `.is-compact` hides it
   * below 901px in menu-art.css.
   */
  compact,
  onOpen,
}: {
  item: MenuItem;
  star?: boolean;
  /** The rows above the fold. Lazy is the wrong default for those. */
  eager?: boolean;
  compact?: boolean;
  onOpen: (item: MenuItem) => void;
}) {
  return (
    <button
      type="button"
      className={`cne-row${star ? " is-star" : ""}${compact ? " is-compact" : ""}`}
      onClick={() => onOpen(item)}
      aria-haspopup="dialog"
    >
      <span className="cne-row-thumb" style={{ position: "relative" }}>
        {star && (
          <Monster
            species="classic"
            bodyColor="#f5b82e"
            irisColor="#e63027"
            size={20}
            className="cne-badge-corner is-tl"
          />
        )}
        {item.photo ? (
          /* The name alone. The button already announces the description and
             the price, so `itemPhotoAlt` would say both a second time, 31 rows
             down the page — but an empty alt leaves 30 photographs that are in
             the image sitemap with no text on the site associating them with
             anything. The full helper is still right in the sheet and on the
             featured cards, where the photograph is the only account of itself. */
          <img
            src={`/menu/${item.photo}-thumb.webp`}
            alt={item.name}
            width={200}
            height={133}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          item.name.split(" ").slice(0, 2).join(" ").toUpperCase()
        )}
      </span>
      <span className="cne-row-name">
        <span className="n">
          {item.name}
          {star ? " ★" : ""}
        </span>
        {item.desc && <span className="d">{item.desc}</span>}
      </span>
      <span className="cne-row-price">{formatPrice(item.price)}</span>
      <span className="cne-chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
