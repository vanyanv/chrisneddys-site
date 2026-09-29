"use client";

import { itemById } from "@/data/menu";
import { describeLine, lineAmountCents } from "@/lib/catering/pricing";
import type { CartLine } from "@/lib/catering/types";
import { money } from "./money";

/** The itemized line list C6/C9/O1/O4/the desktop order rail (D1) all share:
 * qty, item, way/toppings/extras, the "for"/note badges, price. */
export function OrderLines({
  lines,
  editable,
  onEdit,
  onRemove,
}: {
  lines: CartLine[];
  editable?: boolean;
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
}) {
  return (
    <ul className="cor-lines">
      {lines.map((line, i) => {
        const item = itemById(line.itemId);
        const { wayLabel, toppingLabels, extraLabels } = describeLine(line);
        return (
          <li key={`${line.itemId}-${i}`} className="cor-line">
            <span className="cor-line-qty">{line.qty}</span>
            <div className="cor-line-body">
              <p className="cor-line-name">{item?.name ?? line.itemId}</p>
              {line.forName && <span className="cor-line-badge">For {line.forName}</span>}
              {(wayLabel || toppingLabels.length > 0) && (
                <p className="cor-line-way">
                  <b>{wayLabel ?? "Custom"}</b>
                  {toppingLabels.length > 0 ? ` · ${toppingLabels.join(", ")}` : ""}
                </p>
              )}
              {extraLabels.map((label) => (
                <span key={label} className="cor-line-badge is-extra">
                  {label}
                </span>
              ))}
              {line.note && <p className="cor-line-note">&ldquo;{line.note}&rdquo;</p>}
              {editable && (
                <p className="cor-line-actions">
                  <button type="button" onClick={() => onEdit?.(i)}>
                    Edit
                  </button>
                  {" · "}
                  <button type="button" onClick={() => onRemove?.(i)}>
                    Remove
                  </button>
                </p>
              )}
            </div>
            <span className="cor-line-price">{money(lineAmountCents(line))}</span>
          </li>
        );
      })}
    </ul>
  );
}
