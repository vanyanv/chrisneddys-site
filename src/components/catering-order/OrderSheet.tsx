"use client";

import type { CartLine } from "@/lib/catering/types";
import { Sheet } from "./Sheet";
import { OrderLines } from "./OrderLines";
import { money } from "./money";

/** C6: the order sheet — every line, editable, plus "add an order for one
 * person" (a blank single-slider line, per the plan's "Feed my crew" and
 * per-person add pattern) and the running food total. */
export function OrderSheet({
  open,
  lines,
  foodCents,
  onClose,
  onEdit,
  onRemove,
  onAddForOnePerson,
}: {
  open: boolean;
  lines: CartLine[];
  foodCents: number;
  onClose: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAddForOnePerson: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Your order" className="cor-order-sheet">
      <div className="cor-sheet-hd-row">
        <h2>Your order</h2>
        <button type="button" className="cor-sheet-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="cor-sheet-scroll">
        {lines.length === 0 ? (
          <p className="cor-fine">Nothing added yet.</p>
        ) : (
          <OrderLines lines={lines} editable onEdit={onEdit} onRemove={onRemove} />
        )}
        <button
          type="button"
          className="cor-btn is-secondary cor-add-person"
          onClick={onAddForOnePerson}
        >
          + Add an order for one person
        </button>
      </div>
      <div className="cor-sheet-foot">
        <p className="cor-sheet-total">
          Food total <b>{money(foodCents)}</b>
        </p>
        <button type="button" className="cor-btn is-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
