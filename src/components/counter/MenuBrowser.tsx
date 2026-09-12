"use client";

import Link from "next/link";

import { menu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { MenuRow } from "./MenuRow";
import { ItemSheet } from "./ItemSheet";
import { WayPicker } from "./WayPicker";
import { useItemSheet } from "./useItemSheet";

const ORDER: MenuCategoryKey[] = ["combos", "sides", "secret", "drinks"];

/**
 * The whole menu, plus the sheet every row opens.
 *
 * Two layouts out of one DOM, matching the prototype: a phone reads it as a
 * single column of sections, and from 901px up the head of the page becomes a
 * sticky 300px rail — the Ways, the jump list, the pricing note — beside a
 * two-column grid of items. The category label is the same element in both, a
 * mono eyebrow on the phone and a display heading over a rule on desktop.
 */
export function MenuBrowser() {
  const { item, open, way, setWay, openItem, close } = useItemSheet();

  return (
    <>
      <div className="cne-menu">
        <aside className="cne-menu-side cne-sec">
          <div className="cne-eyebrow" id="cne-way-label">
            Pick a way — free
          </div>
          <h1>Everything we make.</h1>
          {/* The eyebrow above is the group's visible name, so it names the
              group programmatically too rather than being decoration a screen
              reader has to guess the relevance of. */}
          <WayPicker way={way} onChange={setWay} labelledBy="cne-way-label" />

          {/* Desktop only — on a phone the sections are a thumb-flick apart. */}
          <nav className="cne-menu-jump" aria-label="Menu sections">
            {ORDER.map((key) => (
              <a key={key} href={`#menu-${key}`}>
                {categoryTitles[key]}
              </a>
            ))}
          </nav>

          <p className="cne-menu-fine">
            <span className="cne-only-phone">
              Every topping is free. Extra cheese +$1, halal +$2.
            </span>
            <span className="cne-only-desk">
              Live Hollywood pickup pricing.
              <br />
              Extra cheese +$1 · halal +$2.
            </span>
          </p>
        </aside>

        <div className="cne-menu-main">
          {ORDER.map((key) => (
            <section className="cne-cat cne-sec cne-rv" key={key} id={`menu-${key}`}>
              <h2 className="cne-cat-h">{categoryTitles[key]}</h2>
              <div className="cne-cat-rule" aria-hidden="true" />
              <div className="cne-menu-grid">
                {menu[key].map((it, i) => (
                  /* The first rows of the first section are on screen at load,
                     and `loading="lazy"` on an above-the-fold image just delays
                     it past the point the browser would have fetched it. */
                  <MenuRow
                    key={it.id}
                    item={it}
                    eager={key === ORDER[0] && i < 2}
                    onOpen={openItem}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="cne-menu-foot">
            Live prices from our{" "}
            <Link href="/order/" style={{ color: "inherit" }}>
              Hollywood ordering page
            </Link>
            . Delivery apps price higher.
          </p>
        </div>
      </div>

      <ItemSheet item={item} open={open} way={way} onWayChange={setWay} onClose={close} />
    </>
  );
}
