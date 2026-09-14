"use client";

import { useActionState } from "react";
import type { AdminOrderDetail } from "@/lib/ordersAdmin";
import { CARRIERS, formatDateTime, trackingUrl } from "../format";
import {
  markPickedUpAction,
  markReadyAction,
  markShippedAction,
  type FulfilmentActionState,
} from "./actions";

const shipInitial: FulfilmentActionState = {};
const readyInitial: FulfilmentActionState = {};
const pickedUpInitial: FulfilmentActionState = {};

function AddressBlock({ shipTo }: { shipTo: AdminOrderDetail["shipTo"] }) {
  if (!shipTo) return <p className="adm-notice">No address on file yet.</p>;
  return (
    <address className="adm-address">
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

function ShipFulfilment({ order }: { order: AdminOrderDetail }) {
  const [state, formAction, pending] = useActionState(markShippedAction, shipInitial);
  const url =
    order.carrier && order.trackingNumber ? trackingUrl(order.carrier, order.trackingNumber) : null;

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Shipping</h2>
      <AddressBlock shipTo={order.shipTo} />

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
        <form action={formAction}>
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
            <p className="adm-error" role="alert">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <p className="adm-notice">Waiting on payment.</p>
      )}
    </div>
  );
}

function PickupFulfilment({
  order,
  pickupAddress,
}: {
  order: AdminOrderDetail;
  pickupAddress: string | null;
}) {
  const [readyState, readyFormAction, readyPending] = useActionState(markReadyAction, readyInitial);
  const [pickedState, pickedFormAction, pickedPending] = useActionState(
    markPickedUpAction,
    pickedUpInitial,
  );

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Pickup</h2>
      {pickupAddress && <p className="adm-notice">{pickupAddress}</p>}

      {order.status === "picked_up" ? (
        <p className="adm-notice">Picked up · {formatDateTime(order.updatedAt)}</p>
      ) : order.status === "ready_for_pickup" ? (
        <form action={pickedFormAction} style={{ marginTop: 10 }}>
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="adm-btn adm-btn-primary" disabled={pickedPending}>
            {pickedPending ? "Marking…" : "Mark picked up"}
          </button>
          {pickedState?.error && (
            <p className="adm-error" role="alert">
              {pickedState.error}
            </p>
          )}
        </form>
      ) : order.status === "paid" ? (
        <form action={readyFormAction} style={{ marginTop: 10 }}>
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="adm-btn adm-btn-primary" disabled={readyPending}>
            {readyPending ? "Marking…" : "Mark ready"}
          </button>
          {readyState?.error && (
            <p className="adm-error" role="alert">
              {readyState.error}
            </p>
          )}
        </form>
      ) : (
        <p className="adm-notice">Waiting on payment.</p>
      )}
    </div>
  );
}

export function FulfilmentCard({
  order,
  pickupAddress,
}: {
  order: AdminOrderDetail;
  pickupAddress: string | null;
}) {
  return order.fulfilment === "pickup" ? (
    <PickupFulfilment order={order} pickupAddress={pickupAddress} />
  ) : (
    <ShipFulfilment order={order} />
  );
}
