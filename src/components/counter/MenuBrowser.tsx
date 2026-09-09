"use client";

import { useState } from "react";
import { menu, categoryTitles, ways, type MenuItem, type MenuCategoryKey } from "@/data/menu";
import { MenuRow } from "./MenuRow";
import { ItemSheet, type WayId } from "./ItemSheet";

const ORDER: MenuCategoryKey[] = ["combos", "sides", "secret", "drinks"];

/** The whole menu, plus the sheet every row opens. */
export function MenuBrowser() {
  const [item, setItem] = useState<MenuItem | null>(null);
  const [way, setWay] = useState<WayId>("chris");

  return (
    <>
      <section className="cne-sec" style={{ paddingTop: 14 }}>
        <div className="cne-eyebrow">Pick a way — free</div>
        <h2>Everything we make.</h2>
        <div className="cne-ways">
          {ways.map((w) => (
            <button
              key={w.id}
              type="button"
              className="cne-way"
              aria-pressed={w.id === way}
              onClick={() => setWay(w.id)}
            >
              <div className="t">{w.name.toUpperCase()}</div>
              <div className="s">{w.summary}</div>
            </button>
          ))}
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--a-sub)",
            margin: 0,
          }}
        >
          Every topping is free. Extra cheese +$1, halal +$2.
        </p>
      </section>

      {ORDER.map((key) => (
        <section className="cne-sec cne-rv" key={key} id={`menu-${key}`}>
          <div className="cne-eyebrow">{categoryTitles[key]}</div>
          <div className="cne-menu-grid">
            {menu[key].map((it) => (
              <MenuRow key={it.id} item={it} onOpen={setItem} />
            ))}
          </div>
        </section>
      ))}

      <div
        style={{
          padding: "6px 15px 18px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          lineHeight: 1.6,
          color: "var(--a-sub)",
        }}
      >
        Live prices from our Hollywood ordering page. Delivery apps price higher.
      </div>

      <ItemSheet item={item} way={way} onWayChange={setWay} onClose={() => setItem(null)} />
    </>
  );
}
