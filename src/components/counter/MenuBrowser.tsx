"use client";

import {
  foodMenu,
  categoryTitles,
  drinkGetsPhoto,
  itemById,
  SECTION_LEADS,
  type MenuCategoryKey,
} from "@/data/menu";
import { MenuRow } from "./MenuRow";
import { MenuDish } from "./MenuDish";
import { MenuLead } from "./MenuLead";
import { MenuSectionChips } from "./MenuSectionChips";
import { LazyItemSheet } from "./LazyItemSheet";
import { CateringCard } from "@/components/catering/CateringCard";
import { WayPicker } from "./WayPicker";
import { useItemSheet } from "./useItemSheet";
import {
  GlyphRow,
  OpStamp,
  MenuPillar,
  SmashStamp,
  type StampKind,
} from "@/components/storeart/SectionOpener";
import { PattyKey } from "./PattyDots";
import "@/styles/menu-art.css";
import "@/styles/menu-dish.css";

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

/** The item the menu opens with, above every section. */
const SIGNATURE = itemById("chris-n-eddy-s-slider");

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
 *
 * Since issue #206 the photos lead: the signature slider opens the menu as a
 * big card, each section opens with its best seller, and every item is a
 * photo card rather than a list row with a thumbnail.
 */
export function MenuBrowser() {
  const { item, open, way, setWay, openItem, switchItem, close } = useItemSheet();

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
          {SIGNATURE && <MenuLead item={SIGNATURE} onOpen={openItem} />}
          {ORDER.map((key) => {
            /* Issue #206: a section opens with its best seller as a wide
               card, then every other item as a photo card. Drinks without a
               photo worth showing (cans, water) stay a name-and-price list
               on a phone — see `.is-compact` in menu-art.css. */
            const leadId = SECTION_LEADS[key];
            const lead = foodMenu[key].find((i) => i.id === leadId);
            const rest = foodMenu[key].filter((i) => i !== lead);
            const cards = key === "drinks" ? rest.filter(drinkGetsPhoto) : rest;
            const listed = key === "drinks" ? rest.filter((i) => !drinkGetsPhoto(i)) : [];
            return (
              <section className="cne-cat cne-sec cne-rv" key={key} id={`menu-${key}`}>
                <h2 className="cne-cat-h">
                  {categoryTitles[key]}
                  {/* Issue #210: Sliders' bullseye is the one the monster smashes. */}
                  {key === "sliders" ? (
                    <SmashStamp />
                  ) : (
                    <OpStamp kind={CAT_STAMP[key]} size={40} className="cne-cat-stamp" />
                  )}
                </h2>
                <div className="cne-cat-rule" aria-hidden="true" />
                {key === "sliders" && <PattyKey />}
                {lead && <MenuDish item={lead} lead onOpen={openItem} />}
                {cards.length > 0 && (
                  <div className={`cne-dish-grid${cards.length % 2 ? " is-odd" : ""}`}>
                    {cards.map((it, i) => (
                      <MenuDish key={it.id} item={it} index={i + 1} onOpen={openItem} />
                    ))}
                  </div>
                )}
                {listed.length > 0 && (
                  <div className="cne-menu-grid">
                    {listed.map((it) => (
                      <MenuRow key={it.id} item={it} compact onOpen={openItem} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          <div className="cne-sec">
            <CateringCard
              eyebrow="Same menu, bigger order"
              title="Feeding a crowd?"
              text="The sliders, fries and shakes on this page, for the whole office."
              surface="menu-catering"
              monster="blue"
            />
          </div>
        </div>
      </div>

      <LazyItemSheet
        item={item}
        open={open}
        way={way}
        onWayChange={setWay}
        onClose={close}
        onSwitch={switchItem}
      />
    </>
  );
}
