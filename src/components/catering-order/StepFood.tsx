"use client";

import { useState } from "react";
import Image from "next/image";
import { foodMenu, categoryTitles, type MenuCategoryKey, type MenuItem } from "@/data/menu";
import { itemPhotoAlt, formatPrice } from "@/lib/otter";
import type { CartLine } from "@/lib/catering/types";
import { OrderLines } from "./OrderLines";
import { money } from "./money";

const ORDER: MenuCategoryKey[] = ["sliders", "combos", "fries", "secret", "drinks"];

function qtyInCart(lines: CartLine[], itemId: string): number {
  return lines.filter((l) => l.itemId === itemId).reduce((sum, l) => sum + l.qty, 0);
}

/** C4/D1: the menu, by category, with the sticky order bar (phone) or the
 * order rail (desktop, from D1). */
export function StepFood({
  lines,
  foodCents,
  onOpenItem,
  onOpenOrder,
  onOpenFeedCrew,
}: {
  lines: CartLine[];
  foodCents: number;
  onOpenItem: (item: MenuItem) => void;
  onOpenOrder: () => void;
  onOpenFeedCrew: () => void;
}) {
  const [cat, setCat] = useState<MenuCategoryKey>("sliders");

  return (
    <div className="cor-step cor-food-step">
      <h1>What are we feeding them?</h1>
      <p className="cor-fine">Every topping is free. Extra cheese +$1, halal +$2.</p>

      <button type="button" className="cor-crew-cta" onClick={onOpenFeedCrew}>
        Feed my crew — get a suggested order for your headcount
      </button>

      <div className="cor-food-layout">
        <div className="cor-food-main">
          <nav className="cor-cat-chips" aria-label="Menu sections">
            {ORDER.map((key) => (
              <button
                key={key}
                type="button"
                className={`cor-chip${cat === key ? " is-selected" : ""}`}
                onClick={() => setCat(key)}
              >
                {categoryTitles[key]}
              </button>
            ))}
          </nav>

          <ul className="cor-menu-grid">
            {foodMenu[cat].map((item) => {
              const inCart = qtyInCart(lines, item.id);
              return (
                <li key={item.id}>
                  <button type="button" className="cor-menu-row" onClick={() => onOpenItem(item)}>
                    <span className="cor-menu-img">
                      {item.photo && (
                        <Image
                          src={`/menu/${item.photo}-thumb.webp`}
                          alt={itemPhotoAlt(item)}
                          width={56}
                          height={56}
                        />
                      )}
                      {inCart > 0 && <span className="cor-menu-badge">{inCart}</span>}
                    </span>
                    <span className="cor-menu-body">
                      <span className="n">{item.name}</span>
                      <span className="d">{item.desc}</span>
                    </span>
                    <span className="cor-menu-price">{formatPrice(item.price)}</span>
                    <span className="cor-menu-arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="cor-food-rail cor-only-desk">
          <h2>Your order</h2>
          {lines.length === 0 ? (
            <p className="cor-fine">Nothing added yet.</p>
          ) : (
            <>
              <OrderLines lines={lines} />
              <p className="cor-food-rail-total">
                Food so far <b>{money(foodCents)}</b>
              </p>
            </>
          )}
          <button type="button" className="cor-btn is-secondary" onClick={onOpenOrder}>
            View order
          </button>
        </aside>
      </div>

      {lines.length > 0 && (
        <button type="button" className="cor-view-order cor-only-phone" onClick={onOpenOrder}>
          View order ({lines.reduce((n, l) => n + l.qty, 0)}) &middot; {money(foodCents)}
        </button>
      )}
    </div>
  );
}
