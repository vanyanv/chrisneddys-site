"use client";

import { useState } from "react";
import { itemById, ways, type WayId } from "@/data/menu";
import { toppingIdsForWay } from "@/lib/catering/menu-adapter";
import { unitPriceCents } from "@/lib/catering/pricing";
import type { CartLine } from "@/lib/catering/types";
import { Sheet } from "./Sheet";
import { money } from "./money";

const TIERS = [
  { id: "light", label: "Light", itemId: "1-slider-and-fries", desc: "1 Slider and Fries each" },
  {
    id: "classic",
    label: "Classic",
    itemId: "2-sliders-and-fries",
    desc: "2 Sliders and Fries each",
  },
  {
    id: "hungry",
    label: "Hungry",
    itemId: "2-triples-and-fries",
    desc: "2 Triples and Fries each",
  },
] as const;

const SHAKE_ITEM_ID = "chocolate-shake-20-oz-cup";
const SODA_ITEM_ID = "coca-cola-20-oz-cup";

/** C7: "Feed my crew" — a headcount-based suggested cart, still editable
 * after. Replaces the current lines with the built suggestion. */
export function FeedCrewSheet({
  open,
  headcount,
  onClose,
  onFill,
}: {
  open: boolean;
  headcount: number;
  onClose: () => void;
  onFill: (lines: CartLine[]) => void;
}) {
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("classic");
  const [wayId, setWayId] = useState<WayId>("chris");
  // Default to about a third of the crew wanting a shake (60 people -> 20),
  // matching c7-feed-my-crew-sheet.png; sodas start at 0. Both stay editable.
  const [shakes, setShakes] = useState(Math.round(headcount / 3));
  const [sodas, setSodas] = useState(0);

  const chosen = TIERS.find((t) => t.id === tier) ?? TIERS[1];
  const mainItem = itemById(chosen.itemId);
  const mainCents = mainItem ? Math.round(mainItem.price * 100) * headcount : 0;
  const shakeCents = shakes * unitPriceCents({ itemId: SHAKE_ITEM_ID, extras: [] });
  const sodaCents = sodas * unitPriceCents({ itemId: SODA_ITEM_ID, extras: [] });
  const totalCents = mainCents + shakeCents + sodaCents;

  function fill() {
    const lines: CartLine[] = [];
    if (mainItem) {
      lines.push({
        itemId: mainItem.id,
        qty: headcount,
        wayId: mainItem.takesToppings ? wayId : null,
        toppings: mainItem.takesToppings ? toppingIdsForWay(wayId) : [],
        extras: [],
      });
    }
    if (shakes > 0)
      lines.push({ itemId: SHAKE_ITEM_ID, qty: shakes, wayId: null, toppings: [], extras: [] });
    if (sodas > 0)
      lines.push({ itemId: SODA_ITEM_ID, qty: sodas, wayId: null, toppings: [], extras: [] });
    onFill(lines);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} label="Feed my crew" className="cor-crew-sheet">
      <button type="button" className="cor-sheet-x" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="cor-sheet-scroll">
        <h2>Feed my crew</h2>
        <p className="cor-fine">For {headcount} people. Every line stays editable.</p>

        <ul className="cor-tier-list">
          {TIERS.map((t) => {
            const item = itemById(t.itemId);
            const cents = item ? Math.round(item.price * 100) * headcount : 0;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`cor-choice${tier === t.id ? " is-selected" : ""}`}
                  onClick={() => setTier(t.id)}
                >
                  <span className="t">{t.label}</span>
                  <span className="s">{t.desc}</span>
                  <span className="p">{money(cents)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="cor-label">Toppings to start with</p>
        <div className="cor-way-row is-compact">
          {ways.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`cor-way-fill${wayId === w.id ? " is-selected" : ""}`}
              onClick={() => setWayId(w.id)}
            >
              {w.name}
            </button>
          ))}
        </div>

        <div className="cor-crew-row">
          <span>Add shakes</span>
          <div className="cor-stepper">
            <button
              type="button"
              aria-label="Fewer shakes"
              onClick={() => setShakes((n) => Math.max(0, n - 1))}
            >
              &minus;
            </button>
            <input type="number" value={shakes} readOnly aria-label="Shakes" />
            <button type="button" aria-label="More shakes" onClick={() => setShakes((n) => n + 1)}>
              +
            </button>
          </div>
        </div>
        <div className="cor-crew-row">
          <span>Add sodas</span>
          <div className="cor-stepper">
            <button
              type="button"
              aria-label="Fewer sodas"
              onClick={() => setSodas((n) => Math.max(0, n - 1))}
            >
              &minus;
            </button>
            <input type="number" value={sodas} readOnly aria-label="Sodas" />
            <button type="button" aria-label="More sodas" onClick={() => setSodas((n) => n + 1)}>
              +
            </button>
          </div>
        </div>
      </div>
      <div className="cor-sheet-foot is-column">
        <button type="button" className="cor-btn is-primary" onClick={fill}>
          Fill my order &middot; {money(totalCents)}
        </button>
        <p className="cor-fine">
          Replaces anything already in your order. You can change toppings line by line after.
        </p>
      </div>
    </Sheet>
  );
}
