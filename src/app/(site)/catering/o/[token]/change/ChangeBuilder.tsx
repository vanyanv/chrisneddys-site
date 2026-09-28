"use client";

import { useMemo, useState } from "react";
import { itemById } from "@/data/menu";
import type { MenuItem } from "@/data/menu";
import { quote, lineKey, describeLine } from "@/lib/catering/pricing";
import { slotsForDate, dayStatus } from "@/lib/catering/schedule";
import { laDateString } from "@/lib/catering/timezone";
import type { CartLine, Fulfilment } from "@/lib/catering/types";
import type { CateringStoreId } from "@/lib/catering/stores";
import type { PublicCateringConfig } from "@/lib/catering/public";
import { addOrMergeLine, removeLineAt, updateLineAt } from "@/components/catering-order/draft";
import { StepFood } from "@/components/catering-order/StepFood";
import { ItemSheet } from "@/components/catering-order/ItemSheet";
import { OrderSheet } from "@/components/catering-order/OrderSheet";
import { OrderBar } from "@/components/catering-order/OrderBar";
import { formatTime } from "@/components/catering-order/SummaryStrip";
import { money } from "@/components/catering-order/money";
import { requestChangeAction } from "../actions";

/** Per-line quantity diffs between the original order and the edited draft,
 * keyed the same way the cart merges lines (item + way + toppings + extras +
 * name + note) — see o2-change-order-review-a-change.png: only lines whose
 * quantity actually changed are listed, old → new. */
function changedLines(
  originalLines: CartLine[],
  currentLines: CartLine[],
): { key: string; label: string; oldQty: number; newQty: number }[] {
  const oldByKey = new Map(originalLines.map((l) => [lineKey(l), l]));
  const newByKey = new Map(currentLines.map((l) => [lineKey(l), l]));
  const keys = [...new Set([...oldByKey.keys(), ...newByKey.keys()])];
  return keys
    .map((k) => {
      const oldLine = oldByKey.get(k);
      const newLine = newByKey.get(k);
      const line = newLine ?? oldLine;
      const item = line ? itemById(line.itemId) : undefined;
      const { wayLabel } = line ? describeLine(line) : { wayLabel: null };
      return {
        key: k,
        label: `${item?.name ?? line?.itemId ?? ""}${wayLabel ? ` · ${wayLabel}` : ""}`,
        oldQty: oldLine?.qty ?? 0,
        newQty: newLine?.qty ?? 0,
      };
    })
    .filter((c) => c.oldQty !== c.newQty);
}

/** O2: a small builder over the existing order — headcount, time (same
 * date), and the same food step/sheets the new-order flow uses — followed by
 * a diff review before sending the change to the owner. */
export function ChangeBuilder({
  token,
  number,
  store,
  fulfilment,
  headcount: initialHeadcount,
  eventAtIso,
  totalCents: originalTotalCents,
  lines: initialLines,
  config,
}: {
  token: string;
  number: string;
  store: CateringStoreId;
  fulfilment: Fulfilment;
  headcount: number;
  eventAtIso: string;
  totalCents: number;
  lines: CartLine[];
  config: PublicCateringConfig;
}) {
  const eventAt = new Date(eventAtIso);
  const dateStr = laDateString(eventAt.getTime());
  const originalTime = `${String(eventAt.getUTCHours()).padStart(2, "0")}:${String(eventAt.getUTCMinutes()).padStart(2, "0")}`;

  const [headcount, setHeadcount] = useState(initialHeadcount);
  const [time, setTime] = useState<string>(originalTime);
  const [lines, setLines] = useState<CartLine[]>(initialLines);
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const status = dayStatus(dateStr, store, config.hours, config.daysOff, Date.now(), headcount);
  const slots = slotsForDate(dateStr, store, config.hours, config.daysOff, Date.now(), headcount);

  const newQuote = useMemo(
    () =>
      quote(lines, {
        fulfilment,
        deliveryFeeCents: config.deliveryFeeCents,
      }),
    [lines, fulfilment, config.deliveryFeeCents],
  );

  async function send() {
    setBusy(true);
    setError(null);
    const result = await requestChangeAction(token, {
      lines,
      headcount,
      time: time !== originalTime ? time : undefined,
    });
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  }

  if (sent) {
    return (
      <section className="cor-link-hero">
        <p className="cor-link-tag">Change {number}</p>
        <h1>Change sent.</h1>
        <p>We&rsquo;ll confirm within 24 hours. Your order stays as it was until then.</p>
      </section>
    );
  }

  if (reviewing) {
    const diff = newQuote.totalCents - originalTotalCents;
    const lineDiffs = changedLines(initialLines, lines);
    return (
      <>
        <section className="cor-link-hero">
          <p className="cor-link-tag">Change {number}</p>
          <h1>What&rsquo;s changing?</h1>
          {headcount !== initialHeadcount && (
            <p className="cor-diff-row">
              <span>People</span>
              <span>
                {initialHeadcount} &rarr; {headcount}
              </span>
            </p>
          )}
          {lineDiffs.map((line) => (
            <p className="cor-diff-row" key={line.key}>
              <span>{line.label}</span>
              <span>
                {line.oldQty} &rarr; {line.newQty}
              </span>
            </p>
          ))}
          <p className="cor-diff-row">
            <span>Time</span>
            <span>
              {time !== originalTime
                ? `${formatTime(originalTime)} → ${formatTime(time)}`
                : `${formatTime(time)} (same)`}
            </span>
          </p>
          <p className="cor-note is-info">
            Changes go back to us to confirm, within 24 hours. Until then your order stays as it
            was.
          </p>
          <div className="cor-review-totals">
            <p className="cor-review-total">
              <span>New total</span>
              <span>{money(newQuote.totalCents)}</span>
            </p>
            {diff !== 0 && (
              <p>
                <span>
                  {diff > 0 ? "Extra on your card when we confirm" : "Refund when we confirm"}
                </span>
                <span>{money(Math.abs(diff))}</span>
              </p>
            )}
          </div>
          {error && <p className="cor-note is-error">{error}</p>}
          {/* Clears the fixed OrderBar below so the last note isn't hidden behind it. */}
          <div aria-hidden="true" style={{ height: 90 }} />
        </section>
        <OrderBar
          totalCents={newQuote.totalCents}
          caption={diff !== 0 ? `${diff > 0 ? "+" : "-"}${money(Math.abs(diff))}` : undefined}
          actionLabel={busy ? "Sending…" : "Send change"}
          onAction={send}
          disabled={busy}
        />
      </>
    );
  }

  return (
    <>
      <section className="cor-step">
        <h1>Change your order</h1>
        <p className="cor-label">How many people?</p>
        <div className="cor-stepper">
          <button type="button" onClick={() => setHeadcount((n) => Math.max(1, n - 5))}>
            &minus;
          </button>
          <input type="number" value={headcount} readOnly />
          <button type="button" onClick={() => setHeadcount((n) => n + 5)}>
            +
          </button>
        </div>

        {status === "open" && (
          <>
            <p className="cor-label">Time on {dateStr}</p>
            <div className="cor-slots">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`cor-slot${time === slot ? " is-selected" : ""}`}
                  onClick={() => setTime(slot)}
                >
                  {formatTime(slot)}
                </button>
              ))}
            </div>
          </>
        )}
        {status !== "open" && <p className="cor-note is-error">That day is no longer available.</p>}
      </section>

      <StepFood
        lines={lines}
        foodCents={newQuote.foodCents}
        onOpenItem={(item) => {
          setEditingIndex(null);
          setOpenItem(item);
        }}
        onOpenOrder={() => setOrderSheetOpen(true)}
        onOpenFeedCrew={() => {}}
      />

      <button type="button" className="cor-btn is-primary" onClick={() => setReviewing(true)}>
        Review change
      </button>

      <ItemSheet
        item={openItem}
        open={openItem != null}
        existingLines={lines}
        initial={editingIndex != null ? (lines[editingIndex] ?? null) : null}
        onClose={() => {
          setOpenItem(null);
          setEditingIndex(null);
        }}
        onAdd={(line) =>
          setLines((cur) =>
            editingIndex != null
              ? updateLineAt(cur, editingIndex, line)
              : addOrMergeLine(cur, line),
          )
        }
      />
      <OrderSheet
        open={orderSheetOpen}
        lines={lines}
        foodCents={newQuote.foodCents}
        onClose={() => setOrderSheetOpen(false)}
        onEdit={(index) => {
          const line = lines[index];
          if (!line) return;
          const item = itemById(line.itemId);
          if (!item) return;
          setEditingIndex(index);
          setOpenItem(item);
        }}
        onRemove={(index) => setLines((cur) => removeLineAt(cur, index))}
        onAddForOnePerson={() => {
          setOrderSheetOpen(false);
          setEditingIndex(null);
          setOpenItem(itemById("2-sliders-and-fries") ?? null);
        }}
      />
    </>
  );
}
