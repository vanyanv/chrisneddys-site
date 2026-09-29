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

const DEFAULT_PEOPLE = 20;

/** C7: "Feed my crew" — a suggested cart sized to a number the customer
 * types right here. That number is only a helper for the suggestion: it is
 * never stored, sent, or required to order. Still editable after. Replaces
 * the current lines with the built suggestion. */
export function FeedCrewSheet({
  open,
  onClose,
  onFill,
}: {
  open: boolean;
  onClose: () => void;
  onFill: (lines: CartLine[]) => void;
}) {
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("classic");
  const [wayId, setWayId] = useState<WayId>("chris");
  const [headcount, setHeadcount] = useState(DEFAULT_PEOPLE);
  // Default to about a third of the crew wanting a shake (60 people -> 20),
  // matching c7-feed-my-crew-sheet.png, until the customer sets their own;
  // sodas start at 0. Both stay editable.
  const [shakesPicked, setShakesPicked] = useState<number | null>(null);
  const shakes = shakesPicked ?? Math.round(headcount / 3);
  const setShakes = (update: (n: number) => number) => setShakesPicked(update(shakes));
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
        <p className="cor-fine">Tell us how many people and we&rsquo;ll suggest an order.</p>

        <div className="cor-crew-row">
          <span>How many people?</span>
          <div className="cor-stepper">
            <button
              type="button"
              aria-label="Fewer people"
              onClick={() => setHeadcount((n) => Math.max(1, n - 5))}
            >
              &minus;
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              aria-label="Number of people"
            />
            <button
              type="button"
              aria-label="More people"
              onClick={() => setHeadcount((n) => n + 5)}
            >
              +
            </button>
          </div>
        </div>

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
