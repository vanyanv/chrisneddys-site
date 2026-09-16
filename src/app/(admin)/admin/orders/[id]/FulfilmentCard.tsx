"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOrderDetail } from "@/lib/ordersAdmin";
import { CARRIERS, formatDateTime, trackingUrl } from "../format";
import {
  markPickedUpAction,
  markReadyAction,
  markShippedAction,
  type FulfilmentActionState,
} from "./actions";
import { OrderToast } from "./OrderToast";

const shipInitial: FulfilmentActionState = {};
const readyInitial: FulfilmentActionState = {};
const pickedUpInitial: FulfilmentActionState = {};

const TOAST_MS = 4000;

/** First name off the order, for a reassurance line ("Sends Anh a tracking
 * email…") — falls back to "the guest" rather than leaving a sentence with
 * nothing in the blank when a name isn't on file. */
function firstName(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.split(/\s+/)[0]! : "the guest";
}

const COPY_RESET_MS = 2000;

/** "Copy address" under the Ship-to card — plain-text clipboard copy of
 * exactly what `AddressBlock` renders, for pasting into a carrier's own
 * label form. Clipboard access can be denied (no permission, an insecure
 * context) with nothing else to fall back to, so a failed copy just leaves
 * the button as it was rather than pretending it worked. */
function CopyAddressButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
      })
      .catch(() => {
        // No clipboard access — nothing else to fall back to.
      });
  }, [text]);

  return (
    <button
      type="button"
      className="rack-btn"
      style={{ width: "100%", marginTop: 15 }}
      onClick={handleCopy}
    >
      {copied ? "Copied" : "Copy address"}
    </button>
  );
}

/** The order's address — shown in the detail page's Customer column, for
 * both a ship order (the customer's address) and a pickup order (handled
 * separately by the page, via the store's `pickupAddress`). Exported so
 * `page.tsx` can render it there instead of duplicating it next to the
 * fulfilment actions. */
export function AddressBlock({ shipTo }: { shipTo: AdminOrderDetail["shipTo"] }) {
  if (!shipTo) return <p className="adm-notice">No address on file yet.</p>;
  const addressText = [
    shipTo.name,
    shipTo.line1,
    shipTo.line2,
    `${shipTo.city}, ${shipTo.state} ${shipTo.postalCode}`,
    shipTo.country,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  return (
    <>
      <address className="adm-address ord-mono">
        {shipTo.name}
        <br />
        {shipTo.line1}
        <br />
        {shipTo.line2 && (
          <>
            {shipTo.line2}
            <br />
          </>
        )}
        {shipTo.city}, {shipTo.state} {shipTo.postalCode}
        <br />
        {shipTo.country}
      </address>
      <CopyAddressButton text={addressText} />
    </>
  );
}

/** A toast message that clears itself after `TOAST_MS`, with a stable
 * `showToast` setter. */
function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  return [toast, showToast] as const;
}

/** Calls `onFire()` the moment a pending action finishes without an error,
 * and refreshes the route — shared by the ship/pickup forms below. These
 * forms read straight off the server-fetched `order` prop with no local
 * optimistic state of their own (unlike the products sheet's `ProductSheet`,
 * which patches its own `rows` state and calls `router.refresh()` as a
 * belt-and-suspenders background sync), so without an explicit
 * `router.refresh()` here, a Server Action completing successfully doesn't
 * by itself re-fetch the page's data — the pill/timeline/action forms would
 * keep showing the pre-mutation order until the next full reload.
 *
 * Deliberately doesn't own toast state itself: `PickupFulfilment` below has
 * two actions (ready, picked up) that must share *one* toast rather than
 * each get their own — picking between two independent toasts by
 * `order.status` raced this same `router.refresh()`: the instant the
 * refreshed order came back e.g. `ready_for_pickup`, a status-keyed ternary
 * would swap from the just-fired "Marked ready for pickup" toast to the
 * still-empty "picked up" one, clearing it before it had a chance to show.
 */
function useActionCompletion(pending: boolean, error: string | undefined, onFire: () => void) {
  const router = useRouter();
  const wasPending = useRef(pending);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      onFireRef.current();
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, error, router]);
}

function ShipFulfilment({ order }: { order: AdminOrderDetail }) {
  const [state, formAction, pending] = useActionState(markShippedAction, shipInitial);
  const [toast, showToast] = useToast();
  useActionCompletion(pending, state?.error, () => showToast("Marked shipped"));
  const url =
    order.carrier && order.trackingNumber ? trackingUrl(order.carrier, order.trackingNumber) : null;

  return (
    <div className="ord-action-group">
      <p className="ord-action-heading">Shipping</p>

      {order.carrier && order.trackingNumber ? (
        <p className="adm-notice">
          {order.carrier} ·{" "}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              {order.trackingNumber} →
            </a>
          ) : (
            order.trackingNumber
          )}
          {order.fulfilledAt && <> · Shipped {formatDateTime(order.fulfilledAt)}</>}
        </p>
      ) : order.status === "paid" ? (
        <form action={formAction} className="ord-action-form">
          <input type="hidden" name="orderId" value={order.id} />
          <div className="adm-field">
            <label htmlFor="carrier" className="adm-label">
              Carrier
            </label>
            <select id="carrier" name="carrier" className="adm-input" defaultValue="USPS">
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label htmlFor="trackingNumber" className="adm-label">
              Tracking number
            </label>
            <input
              id="trackingNumber"
              name="trackingNumber"
              type="text"
              className="adm-input"
              required
            />
          </div>
          <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
            {pending ? "Marking…" : "Mark shipped & email guest"}
          </button>
          <p className="adm-help">
            Sends {firstName(order.name)} a tracking email as soon as this is marked shipped.
          </p>
          {state?.error && (
            <p className="adm-field-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <p className="adm-notice">Waiting on payment.</p>
      )}
      <OrderToast message={toast} />
    </div>
  );
}

function PickupFulfilment({ order }: { order: AdminOrderDetail }) {
  const [readyState, readyFormAction, readyPending] = useActionState(markReadyAction, readyInitial);
  const [pickedState, pickedFormAction, pickedPending] = useActionState(
    markPickedUpAction,
    pickedUpInitial,
  );
  const [toast, showToast] = useToast();
  useActionCompletion(readyPending, readyState?.error, () => showToast("Marked ready for pickup"));
  useActionCompletion(pickedPending, pickedState?.error, () => showToast("Marked picked up"));

  return (
    <div className="ord-action-group">
      <p className="ord-action-heading">Pickup</p>

      {order.status === "picked_up" ? (
        <p className="adm-notice">Picked up · {formatDateTime(order.updatedAt)}</p>
      ) : order.status === "ready_for_pickup" ? (
        <form action={pickedFormAction} className="ord-action-form">
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="adm-btn adm-btn-primary" disabled={pickedPending}>
            {pickedPending ? "Marking…" : "Mark picked up"}
          </button>
          {pickedState?.error && (
            <p className="adm-field-error" role="alert">
              {pickedState.error}
            </p>
          )}
        </form>
      ) : order.status === "paid" ? (
        <form action={readyFormAction} className="ord-action-form">
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="adm-btn adm-btn-primary" disabled={readyPending}>
            {readyPending ? "Marking…" : "Mark ready & email guest"}
          </button>
          <p className="adm-help">
            Sends {firstName(order.name)} a pickup-ready email as soon as this is marked ready.
          </p>
          {readyState?.error && (
            <p className="adm-field-error" role="alert">
              {readyState.error}
            </p>
          )}
        </form>
      ) : (
        <p className="adm-notice">Waiting on payment.</p>
      )}
      <OrderToast message={toast} />
    </div>
  );
}

export function FulfilmentCard({ order }: { order: AdminOrderDetail }) {
  return order.fulfilment === "pickup" ? (
    <PickupFulfilment order={order} />
  ) : (
    <ShipFulfilment order={order} />
  );
}
