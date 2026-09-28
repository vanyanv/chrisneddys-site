"use client";

import { money } from "./money";

/**
 * The sticky black bar at the bottom of every builder step: the running
 * total on the left ("Nothing added yet" before the first line), the
 * primary action on the right.
 */
export function OrderBar({
  totalCents,
  caption,
  actionLabel,
  onAction,
  disabled,
}: {
  totalCents: number;
  caption?: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="cor-bar">
      <div className="cor-bar-total">
        <span className="cor-bar-amt">{money(totalCents)}</span>
        <span className="cor-bar-cap">
          {caption ?? (totalCents === 0 ? "Nothing added yet" : "")}
        </span>
      </div>
      <button type="button" className="cor-btn is-primary" onClick={onAction} disabled={disabled}>
        {actionLabel}
      </button>
    </div>
  );
}
