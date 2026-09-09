"use client";

import type { MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/otter";

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
  onOpen,
}: {
  item: MenuItem;
  star?: boolean;
  onOpen: (item: MenuItem) => void;
}) {
  return (
    <button
      type="button"
      className={`cne-row${star ? " is-star" : ""}`}
      onClick={() => onOpen(item)}
      aria-haspopup="dialog"
    >
      <span className="cne-row-thumb">
        {item.photo ? (
          <img
            src={`/menu/${item.photo}-thumb.webp`}
            alt=""
            width={200}
            height={133}
            loading="lazy"
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
