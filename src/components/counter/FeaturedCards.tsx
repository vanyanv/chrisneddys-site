"use client";

import { allItems, type MenuItem } from "@/data/menu";
import { formatPrice, itemPhotoAlt } from "@/lib/otter";
import { ItemSheet } from "./ItemSheet";
import { useItemSheet } from "./useItemSheet";

/** The three the prototype leads with. */
const FEATURED = [
  "7bbcdf64-0e6f-489f-8ca4-0bee1e835bb0", // 2 Sliders and Fries — most ordered
  "de38e42c-7600-473f-913f-acb6b2a45aa8", // Chris N Eddy's Slider — the signature
  "43d72be5-d38f-459d-9306-4c45f512715a", // The Quad — the secret-menu hook
];

export function FeaturedCards() {
  const { item, open, way, setWay, openItem, close } = useItemSheet();
  const items = FEATURED.map((id) => allItems.find((i) => i.otterId === id)).filter(
    (i): i is MenuItem => Boolean(i),
  );

  return (
    <>
      <div className="cne-cardgrid">
        {items.map((it, i) => (
          <button
            key={it.id}
            type="button"
            className={`cne-card${i === 0 ? " is-star" : ""}`}
            onClick={() => openItem(it)}
            aria-haspopup="dialog"
          >
            <span className="cne-card-img">
              {it.photo && (
                /* A 60px square on a phone, a full-width card image on desktop.
                   Without this the phone downloaded the 720px version to draw
                   it at 60px. */
                <img
                  src={`/menu/${it.photo}.webp`}
                  srcSet={`/menu/${it.photo}-thumb.webp 200w, /menu/${it.photo}.webp 720w`}
                  sizes="(min-width: 901px) 440px, 60px"
                  alt={itemPhotoAlt(it)}
                  width={720}
                  height={479}
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
              <h3>{it.name}</h3>
              <p>{it.desc}</p>
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
      <ItemSheet item={item} open={open} way={way} onWayChange={setWay} onClose={close} />
    </>
  );
}
