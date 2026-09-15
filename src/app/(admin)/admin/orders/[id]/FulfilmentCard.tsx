"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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

/** The order's address — shown in the detail page's Customer column, for
 * both a ship order (the customer's address) and a pickup order (handled
 * separately by the page, via the store's `pickupAddress`). Exported so
 * `page.tsx` can render it there instead of duplicating it next to the
 * fulfilment actions. */
export function AddressBlock({ shipTo }: { shipTo: AdminOrderDetail["shipTo"] }) {
  if (!shipTo) return <p className="adm-notice">No address on file yet.</p>;
  return (
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
  );
}

/** Fires a toast the moment a pending action finishes without an error —
 * shared by the ship/pickup forms below. */
function useActionToast(pending: boolean, error: string | undefined, message: string) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending && !error) {
      setToast(message);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), TOAST_MS);
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, error]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return toast;
}

function ShipFulfilment({ order }: { order: AdminOrderDetail }) {
  const [state, formAction, pending] = useActionState(markShippedAction, shipInitial);
  const toast = useActionToast(pending, state?.error, "Marked shipped");
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
            {pending ? "Marking…" : "Mark shipped"}
          </button>
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
  const readyToast = useActionToast(readyPending, readyState?.error, "Marked ready for pickup");
  const pickedToast = useActionToast(pickedPending, pickedState?.error, "Marked picked up");

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
            {readyPending ? "Marking…" : "Mark ready for pickup"}
          </button>
          {readyState?.error && (
            <p className="adm-field-error" role="alert">
              {readyState.error}
            </p>
          )}
        </form>
      ) : (
        <p className="adm-notice">Waiting on payment.</p>
      )}
      <OrderToast message={order.status === "ready_for_pickup" ? pickedToast : readyToast} />
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
