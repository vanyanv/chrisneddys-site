"use client";

import { allItems, type MenuItem } from "@/data/menu";
import { FEATURED_OTTER_IDS } from "@/data/featured";
import { formatPrice, itemPhotoAlt } from "@/lib/otter";
import { LazyItemSheet } from "./LazyItemSheet";
import { useItemSheet } from "./useItemSheet";
import { MenuPhoto } from "./MenuPhoto";

export function FeaturedCards() {
  const { item, open, way, setWay, openItem, switchItem, close, from } = useItemSheet();
  const items = FEATURED_OTTER_IDS.map((id) => allItems.find((i) => i.otterId === id)).filter(
    (i): i is MenuItem => Boolean(i),
  );

  return (
    <>
      {/* Desktop tilt (motion.css): one delegated listener hands the hovered
          card its pointer position as --rx/--ry; CSS does the rest. */}
      <div
        className="cne-cardgrid cne-stagger cne-tilt"
        onPointerMove={(e) => {
          const c = (e.target as Element).closest<HTMLElement>(".cne-card");
          if (!c) return;
          const r = c.getBoundingClientRect();
          c.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(1));
          c.style.setProperty("--rx", (((e.clientY - r.top) / r.height - 0.5) * -8).toFixed(1));
        }}
      >
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            className={`cne-card${i === 0 ? " is-star" : ""}`}
            onClick={(e) => openItem(it, e.currentTarget)}
            aria-haspopup="dialog"
          >
            <span className="cne-card-img">
              {it.photo && (
                /* A 60px square on a phone (the 3:2 photo drawn 90px wide to
                   cover it), a 16:10 card image on a tablet and a computer.
                   Without this the phone downloaded the 720px version to draw
                   it at 60px. */
                <MenuPhoto
                  photo={it.photo}
                  sizes="(min-width: 56.3125em) 440px, (min-width: 37.5em) 260px, 90px"
                  alt={itemPhotoAlt(it)}
                  loading="lazy"
                  decoding="async"
                />
              )}
              {i === 0 && (
                <span className="cne-card-rib" aria-hidden="true">
                  MOST ORDERED
                </span>
              )}
            </span>
            <span className="cne-card-body">
              {/* Spans, not h3/p: headings and paragraphs aren't allowed inside a
                  <button>, and screen readers drop their roles there anyway. */}
              <span className="cne-card-name">{it.name}</span>
              <span className="cne-card-desc">{it.desc}</span>
              <span className="cne-card-ft">
                <span className="cne-card-pr">{formatPrice(it.price)}</span>
                <span className="cne-card-cta" aria-hidden="true">
                  <span className="cne-only-phone">&rsaquo;</span>
                  <span className="cne-only-desk-i">PICK YOURS &rarr;</span>
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <LazyItemSheet
        item={item}
        open={open}
        way={way}
        onWayChange={setWay}
        onClose={close}
        onSwitch={switchItem}
        from={from}
      />
    </>
  );
}
