"use client";

import { useState } from "react";
import type { CartLine, Quote, TipInput } from "@/lib/catering/types";
import { OrderLines } from "./OrderLines";
import { money } from "./money";

const TIP_PERCENTS = [0, 10, 15, 20];

/** C9: the full itemized review, tip, disposables count, and the totals bar
 * that fires the checkout request. */
export function StepReview({
  lines,
  quote,
  tip,
  onTipChange,
  plateSets,
  onPlateSets,
  checkoutError,
}: {
  lines: CartLine[];
  quote: Quote;
  tip: TipInput;
  onTipChange: (tip: TipInput) => void;
  plateSets: number;
  onPlateSets: (n: number) => void;
  checkoutError: string | null;
}) {
  const selectedPercent = "tipPercent" in tip ? tip.tipPercent : null;
  const [customOpen, setCustomOpen] = useState(selectedPercent === null);
  const [customValue, setCustomValue] = useState(
    "tipCents" in tip ? (tip.tipCents / 100).toFixed(2) : "",
  );

  return (
    <div className="cor-step">
      <h1>Check it, then send it</h1>

      {checkoutError === "too-soon" && (
        <p className="cor-note is-error">
          That time is now too soon to prep — please go back and pick a later slot.
        </p>
      )}
      {checkoutError === "closed" && (
        <p className="cor-note is-error">We just closed that day. Please pick another time.</p>
      )}
      {checkoutError === "out-of-range" && (
        <p className="cor-note is-error">
          That address is outside our delivery range. Please switch to pickup or another address.
        </p>
      )}
      {checkoutError === "price-changed" && (
        <p className="cor-note is-error">
          A price changed since you started. We&rsquo;ve updated your total below — please review
          and send again.
        </p>
      )}
      {checkoutError === "card-declined" && (
        <p className="cor-note is-error">Your card was declined. Try another card.</p>
      )}
      {checkoutError === "off" && (
        <p className="cor-note is-error">
          Catering ordering just turned off. Please message us instead.
        </p>
      )}

      <OrderLines lines={lines} />

      <div className="cor-review-tips">
        <p className="cor-label">Tip for the crew</p>
        <div className="cor-tip-row">
          {TIP_PERCENTS.map((p) => (
            <button
              key={p}
              type="button"
              className={`cor-chip${!customOpen && selectedPercent === p ? " is-selected" : ""}`}
              onClick={() => {
                setCustomOpen(false);
                onTipChange({ tipPercent: p });
              }}
            >
              {p}%
            </button>
          ))}
          <button
            type="button"
            className={`cor-chip${customOpen ? " is-selected" : ""}`}
            onClick={() => setCustomOpen(true)}
          >
            Custom
          </button>
        </div>
        {customOpen && (
          <label className="cor-field">
            <span className="cor-label">Custom tip ($)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                const n = Number(e.target.value);
                onTipChange({ tipCents: Number.isFinite(n) ? Math.round(n * 100) : 0 });
              }}
            />
          </label>
        )}
      </div>

      <div className="cor-review-plates">
        <p className="cor-label">Plates, napkins &amp; utensil sets</p>
        <div className="cor-stepper">
          <button
            type="button"
            aria-label="Fewer sets"
            onClick={() => onPlateSets(Math.max(0, plateSets - 1))}
          >
            &minus;
          </button>
          <input type="number" value={plateSets} readOnly aria-label="Plate sets" />
          <button type="button" aria-label="More sets" onClick={() => onPlateSets(plateSets + 1)}>
            +
          </button>
        </div>
      </div>

      <div className="cor-review-totals">
        <p>
          <span>Food</span>
          <span>{money(quote.foodCents)}</span>
        </p>
        {quote.deliveryCents > 0 && (
          <p>
            <span>Delivery</span>
            <span>{money(quote.deliveryCents)}</span>
          </p>
        )}
        <p>
          <span>Tax</span>
          <span>{money(quote.taxCents)}</span>
        </p>
        <p>
          <span>Tip</span>
          <span>{money(quote.tipCents)}</span>
        </p>
        <p className="cor-review-total">
          <span>Total</span>
          <span>{money(quote.totalCents)}</span>
        </p>
        <p className="cor-fine">Held, not charged, until we confirm.</p>
      </div>
    </div>
  );
}
