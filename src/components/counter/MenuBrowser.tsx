"use client";

import Link from "next/link";
import { foodMenu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { MenuRow } from "./MenuRow";
import { MenuSectionChips } from "./MenuSectionChips";
import { ItemSheet } from "./ItemSheet";
import { WayPicker } from "./WayPicker";
import { useItemSheet } from "./useItemSheet";
import { GlyphRow, OpStamp, MenuPillar, type StampKind } from "@/components/storeart/SectionOpener";
import "@/styles/menu-art.css";

/**
 * Sliders first (the house slider leads, not buried under a side-dish
 * heading), then the combos built from them, then fries and sides, then the
 * Secret Menu, then Drinks. Both the phone jump chips and the desktop side
 * list are built from this one array, so they can't drift out of sync.
 */
const ORDER: MenuCategoryKey[] = ["sliders", "combos", "fries", "secret", "drinks"];

/**
 * Short labels for the phone chip strip — a pill is a bad place for the full
 * "Slider & Fries Combos" heading. Every other section's chip matches its
 * heading exactly, so only this one needs an entry.
 */
const CHIP_LABEL: Partial<Record<MenuCategoryKey, string>> = {
  combos: "Combos",
};

/** Idea 4: each category heading ends in its own op-art stamp, cycling the
 * five kinds in the order the categories are shown. */
const CAT_STAMP: Record<MenuCategoryKey, StampKind> = {
  sliders: "bullseye",
  combos: "stripe",
  fries: "checker",
  secret: "square",
  drinks: "pink",
};

/**
 * The whole menu, plus the sheet every row opens.
 *
 * Two layouts out of one DOM, matching the prototype: a phone reads it as a
 * single column of sections, and from 901px up the head of the page becomes a
 * sticky 300px rail — the Ways, the jump list, the pricing note — beside a
 * two-column grid of items. The category label is the same element in both, a
 * mono eyebrow on the phone and a display heading over a rule on desktop.
 *
 * The phone-only chip strip below is hidden entirely above 901px
 * (`.cne-menu-chipnav`'s own media query), so it costs the desktop grid
 * nothing — it still only ever lays out the aside and `.cne-menu-main`.
 *
 * A phone goes heading, one line of pricing, section chips, then photos
 * (issue #155). It used to carry its own "Asked about most" list of six links
 * here too, repeating rows a thumb-length below; the page's item links live
 * in its desktop list, which stays in the HTML at every width.
 */
export function MenuBrowser() {
  const { item, open, way, setWay, openItem, close } = useItemSheet();

  return (
    <>
      <div className="cne-menu">
        <aside className="cne-menu-side cne-sec">
          {/* The Ways lead the desktop rail. A phone gets them in each
              slider's own sheet instead (issue #155): up here they stood
              between the heading and the first photo, which started 763px
              down a 390px-wide phone. */}
          <div className="cne-only-desk">
            <GlyphRow />
            <div className="cne-eyebrow" id="cne-way-label">
              Pick a way — free
            </div>
          </div>
          <h1>Everything we make.</h1>
          {/* The eyebrow above is the group's visible name, so it names the
              group programmatically too rather than being decoration a screen
              reader has to guess the relevance of. */}
          <div className="cne-only-desk">
            <WayPicker way={way} onChange={setWay} labelledBy="cne-way-label" />
          </div>

          {/* Desktop only — on a phone the chip strip below does this job. */}
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
            <span className="cne-only-desk">Extra cheese +$1 · halal +$2.</span>
          </p>
          <MenuPillar />
        </aside>

        <MenuSectionChips
          sections={ORDER.map((key) => ({ key, label: CHIP_LABEL[key] ?? categoryTitles[key] }))}
        />

        <div className="cne-menu-main">
          {ORDER.map((key) => (
            <section className="cne-cat cne-sec cne-rv" key={key} id={`menu-${key}`}>
              <h2 className="cne-cat-h">
                {categoryTitles[key]}
                <OpStamp kind={CAT_STAMP[key]} size={40} className="cne-cat-stamp" />
              </h2>
              <div className="cne-cat-rule" aria-hidden="true" />
              <div className="cne-menu-grid">
                {foodMenu[key].map((it, i) => (
                  /* The first rows of the first section are on screen at load,
                     and `loading="lazy"` on an above-the-fold image just delays
                     it past the point the browser would have fetched it. */
                  <MenuRow
                    key={it.id}
                    item={it}
                    eager={key === ORDER[0] && i < 2}
                    // Drinks read as a compact name+price list on a phone —
                    // thirteen photo tiles is two screens of scrolling for a
                    // Coke. Desktop is unaffected; see `.is-compact` in
                    // menu-art.css.
                    compact={key === "drinks"}
                    onOpen={openItem}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="cne-menu-foot">
            Live prices from our{" "}
            <Link prefetch={false} href="/order/" style={{ color: "inherit" }}>
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
