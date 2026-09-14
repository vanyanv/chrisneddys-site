"use client";

import { useActionState } from "react";
import { lookupOrderAction, type OrderLookupResult, type OrderLookupState } from "./actions";

const initialState: OrderLookupState = {};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  border: "2px solid var(--a-ink, #1a1612)",
  background: "var(--a-paper, #fff8e7)",
  color: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

function statusText(result: OrderLookupResult): string {
  switch (result.status) {
    case "paid":
      return "Paid — we're getting it ready.";
    case "fulfilled":
      return result.carrier && result.trackingNumber
        ? `Shipped — ${result.carrier}, tracking ${result.trackingNumber}.`
        : "Shipped.";
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

export function OrderLookupForm() {
  const [state, formAction, pending] = useActionState(lookupOrderAction, initialState);

  return (
    <div>
      <form
        action={formAction}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: "42ch" }}
      >
        <div>
          <label htmlFor="order-number" style={labelStyle}>
            Order number
          </label>
          <input
            id="order-number"
            name="number"
            type="text"
            placeholder="CNE-1042"
            autoComplete="off"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="order-email" style={labelStyle}>
            Email used at checkout
          </label>
          <input
            id="order-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            style={inputStyle}
          />
        </div>

        {state.error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--a-red, #e63027)" }}>
            {state.error}
          </p>
        )}

        <button
          type="submit"
          className="cne-btn-primary"
          disabled={pending}
          style={{ alignSelf: "flex-start", cursor: pending ? "wait" : "pointer" }}
        >
          {pending ? "LOOKING UP…" : "LOOK UP ORDER"}
        </button>
      </form>

      {state.result && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Order {state.result.number}</h2>
          <p style={{ margin: "0 0 14px", fontWeight: 700 }}>{statusText(state.result)}</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
            {state.result.items.map((item, i) => (
              <li key={i}>
                {item.name}
                {item.editionNumber != null
                  ? ` — #${item.editionNumber}${item.editionSize ? ` of ${item.editionSize}` : ""}`
                  : ` × ${item.quantity}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
