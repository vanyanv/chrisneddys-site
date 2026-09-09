"use client";

import { allItems, type MenuItem } from "@/data/menu";
import { formatPrice } from "@/lib/otter";
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
                <img
                  src={`/menu/${it.photo}.webp`}
                  alt=""
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
                  Order
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
