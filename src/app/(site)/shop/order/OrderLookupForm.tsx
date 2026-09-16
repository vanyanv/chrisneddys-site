"use client";

import { useActionState } from "react";
import { lookupOrderAction, type OrderLookupResult, type OrderLookupState } from "./actions";
import { orderTimeline } from "@/lib/orderTracking";

const initialState: OrderLookupState = {};

/**
 * "Order status." — the lookup form and its result, drawn with the same
 * ruled-line input the guest check uses (`.cne-ck-*`, `src/components/contact/GuestCheck.tsx`)
 * instead of a boxed generic `<input>`, so this is the same site as the rest
 * of the shop rather than a bare HTML form bolted on next to it.
 *
 * There is no per-order URL: the order number plus the email used at
 * checkout is the credential, submitted through a server action rather than
 * a `GET /shop/order/CNE-1043` a stranger could guess or a search engine
 * could index. That's a deliberate, existing choice this pass doesn't
 * change — see `actions.ts`'s throttling and its generic "not found" for
 * every kind of miss.
 */
function statusHeadline(result: OrderLookupResult): string {
  switch (result.status) {
    case "paid":
      return "Paid. We're getting it ready.";
    case "fulfilled":
      return "On its way.";
    case "ready_for_pickup":
      return "Ready for pickup.";
    case "picked_up":
      return "Picked up.";
    case "refunded":
      return "Refunded.";
    default:
      return "";
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderLookupForm() {
  const [state, formAction, pending] = useActionState(lookupOrderAction, initialState);

  return (
    <div className="cne-ord">
      <form action={formAction} noValidate className="cne-ord-form">
        <div className="cne-ck-field">
          <label className="cne-ck-label" htmlFor="order-number">
            Order number
          </label>
          <span className="cne-ck-line">
            <input
              id="order-number"
              name="number"
              type="text"
              placeholder="CNE-1042"
              autoComplete="off"
              required
              className="cne-ck-input"
            />
            <span className="cne-ck-underline" aria-hidden="true" />
          </span>
        </div>

        <div className="cne-ck-field">
          <label className="cne-ck-label" htmlFor="order-email">
            Email used at checkout
          </label>
          <span className="cne-ck-line">
            <input
              id="order-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              className="cne-ck-input"
            />
            <span className="cne-ck-underline" aria-hidden="true" />
          </span>
        </div>

        {state.error && (
          <p className="cne-ck-err" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="cne-btn-primary cne-ord-submit" disabled={pending}>
          {pending ? "LOOKING UP…" : "LOOK UP ORDER"}
        </button>
      </form>

      {state.result && <OrderResult result={state.result} />}
    </div>
  );
}

function OrderResult({ result }: { result: OrderLookupResult }) {
  const steps = orderTimeline(result);

  return (
    <div className="cne-ord-result" role="status" aria-live="polite">
      <div className="cne-eyebrow">Order</div>
      <h2 className="cne-ord-number">{result.number}</h2>
      <p className="cne-ord-headline">{statusHeadline(result)}</p>

      <ul className="cne-ord-items">
        {result.items.map((item, i) => (
          <li key={i}>
            <span>
              {item.name}
              {item.editionNumber == null && ` × ${item.quantity}`}
            </span>
            {item.editionNumber != null && (
              <span className="cne-ord-numchip">
                <span className="eyebrow">No.</span>
                {item.editionNumber}
                {item.editionSize ? <span className="of"> / {item.editionSize}</span> : null}
              </span>
            )}
          </li>
        ))}
      </ul>

      {result.status === "refunded" ? (
        <p className="cne-ord-refunded">This order was refunded.</p>
      ) : (
        steps && (
          <ol className="cne-ord-timeline">
            {steps.map((step) => (
              <li key={step.label} className={step.done ? "is-done" : ""}>
                <span className="cne-ord-dot" aria-hidden="true" />
                <span className="cne-ord-step-label">{step.label}</span>
                <span className="cne-ord-step-detail">{step.detail}</span>
              </li>
            ))}
          </ol>
        )
      )}

      {result.fulfilment === "ship" && result.shipTo && (
        <div className="cne-ord-address">
          <div className="cne-ck-label">Going to</div>
          <address>
            {result.shipTo.name}
            <br />
            {result.shipTo.line1}
            {result.shipTo.line2 && (
              <>
                <br />
                {result.shipTo.line2}
              </>
            )}
            <br />
            {result.shipTo.city}, {result.shipTo.state} {result.shipTo.postalCode}
          </address>
        </div>
      )}

      {(result.paidAt || result.fulfilledAt || result.refundedAt) && (
        <p className="cne-ord-meta">
          {result.paidAt && <>Paid {formatWhen(result.paidAt)}. </>}
          {result.fulfilledAt && <>Shipped {formatWhen(result.fulfilledAt)}. </>}
          {result.refundedAt && <>Refunded {formatWhen(result.refundedAt)}.</>}
        </p>
      )}
    </div>
  );
}
