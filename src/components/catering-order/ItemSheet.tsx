"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { MenuItem, WayId } from "@/data/menu";
import { ways, toppings } from "@/data/menu";
import { itemPhotoAlt, formatPrice } from "@/lib/otter";
import { EXTRAS, resolveWay, toppingIdsForWay } from "@/lib/catering/menu-adapter";
import { unitPriceCents, MAX_QTY, MAX_NAME_LENGTH, MAX_NOTE_LENGTH } from "@/lib/catering/pricing";
import { lineKey } from "@/lib/catering/pricing";
import type { CartLine } from "@/lib/catering/types";
import { Sheet } from "./Sheet";
import { money } from "./money";

export type ItemSheetResult = { line: CartLine; addAnother: boolean };

/** C5/D2: the item sheet — photo, price, a Way (each topping toggles on its
 * own, Otter-style), paid extras, qty, an optional name and note. */
export function ItemSheet({
  item,
  open,
  existingLines,
  initial,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  open: boolean;
  existingLines: CartLine[];
  /** Set when reopening the sheet to edit an existing line (C6's "Edit"). */
  initial?: CartLine | null;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [forName, setForName] = useState("");
  const [note, setNote] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setToppingIds(initial?.toppings ?? []);
    setExtraIds(initial?.extras ?? []);
    setQty(initial?.qty ?? 1);
    setForName(initial?.forName ?? "");
    setNote(initial?.note ?? "");
    setJustAdded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, initial]);

  if (!item) return null;

  const wayId = resolveWay(toppingIds);
  const line: CartLine = {
    itemId: item.id,
    qty,
    wayId,
    toppings: toppingIds,
    extras: extraIds,
    forName: forName.trim() || undefined,
    note: note.trim() || undefined,
  };
  const unit = unitPriceCents(line);
  const matchesExisting = existingLines.some((l) => lineKey(l) === lineKey(line));

  function toggleTopping(id: string) {
    setToppingIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  function quickFill(way: (typeof ways)[number]) {
    setToppingIds(toppingIdsForWay(way.id as WayId));
  }

  const editing = Boolean(initial);

  function handleAdd() {
    onAdd(line);
    if (editing) {
      onClose();
      return;
    }
    setJustAdded(forName.trim() || "your order");
    setForName("");
    setNote("");
    setQty(1);
  }

  return (
    <Sheet open={open} onClose={onClose} label={item.name} className="cor-item-sheet">
      <button type="button" className="cor-sheet-x" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="cor-sheet-scroll">
        <div className="cor-sheet-photo">
          {item.photo && (
            <Image
              src={`/menu/${item.photo}.webp`}
              alt={itemPhotoAlt(item)}
              width={360}
              height={240}
            />
          )}
        </div>
        <p className="cor-sheet-name">{item.name}</p>
        <div className="cor-sheet-hd">
          <span>Catering · Each</span>
          <span className="p">{formatPrice(unit / 100)}</span>
        </div>
        <p className="cor-sheet-desc">{item.desc}</p>

        {item.takesToppings && (
          <>
            <div className="cor-sheet-section-hd">
              <span>Pick a Way</span>
              <span className="hint">Quick fill</span>
            </div>
            <div className="cor-way-row">
              {ways.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="cor-way-fill"
                  onClick={() => quickFill(w)}
                >
                  <span className="t">{w.name.toUpperCase()}</span>
                  <span className="s">{w.summary}</span>
                </button>
              ))}
            </div>

            <div className="cor-sheet-section-hd">
              <span>Toppings</span>
              <span className="hint">Free · pick any</span>
            </div>
            <ul className="cor-topping-list">
              {toppings.map((t) => {
                const on = toppingIds.includes(t.id);
                return (
                  // The price badge is a sibling of `<label>`, not a child
                  // of it: a `<label>`'s associated-control name (what
                  // `getByLabel`/assistive tech read as the checkbox's
                  // name) is every bit of text inside it, so nesting "Free"
                  // there would make the name "Add {t.name} Free" instead
                  // of "Add {t.name}" — the price is a visual aside, not
                  // part of what the control is called. `.cor-topping-row`
                  // (now on this `<li>`) still lays both out as one flex
                  // row.
                  <li key={t.id} className="cor-topping-row">
                    <label>
                      <input type="checkbox" checked={on} onChange={() => toggleTopping(t.id)} />
                      <span className="n">Add {t.name}</span>
                    </label>
                    <span className="v">Free</span>
                  </li>
                );
              })}
            </ul>

            <div className="cor-sheet-section-hd">
              <span>Extras</span>
            </div>
            <ul className="cor-topping-list">
              {EXTRAS.map((e) => {
                const on = extraIds.includes(e.id);
                return (
                  // Same reasoning as the topping row above: the price
                  // stays a sibling of `<label>`, not a child of it.
                  <li key={e.id} className="cor-topping-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setExtraIds((cur) =>
                            cur.includes(e.id) ? cur.filter((id) => id !== e.id) : [...cur, e.id],
                          )
                        }
                      />
                      <span className="n">{e.name}</span>
                    </label>
                    <span className="v">+{formatPrice(e.price)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="cor-sheet-section-hd">
          <span>Who&rsquo;s it for?</span>
          <span className="hint">Optional · printed on the ticket</span>
        </div>
        <input
          type="text"
          className="cor-sheet-input"
          value={forName}
          maxLength={MAX_NAME_LENGTH}
          placeholder="A name, like Dev Patel, or a group, like Art dept"
          onChange={(e) => setForName(e.target.value)}
        />

        <div className="cor-sheet-section-hd">
          <span>Note</span>
          <span className="hint">Optional</span>
        </div>
        <textarea
          className="cor-sheet-input"
          value={note}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="No onion, allergy, anything the crew should know"
          onChange={(e) => setNote(e.target.value)}
        />

        {matchesExisting && (
          <p className="cor-note">
            Same build already in your order — adding this will add to that line&rsquo;s quantity.
          </p>
        )}
        {justAdded && (
          <p className="cor-note is-ok">Added for {justAdded}. Add one for someone else?</p>
        )}
      </div>

      <div className="cor-sheet-foot">
        <div className="cor-stepper">
          <button
            type="button"
            aria-label="Fewer"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            &minus;
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Quantity"
            value={qty}
            min={1}
            max={MAX_QTY}
            onChange={(e) =>
              setQty(Math.min(MAX_QTY, Math.max(1, Math.floor(Number(e.target.value) || 1))))
            }
          />
          <button
            type="button"
            aria-label="More"
            onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
          >
            +
          </button>
        </div>
        <button type="button" className="cor-btn is-primary" onClick={handleAdd}>
          {editing ? "Save" : `Add ${qty}`} &middot; {money(unit * qty)}
        </button>
      </div>
    </Sheet>
  );
}
