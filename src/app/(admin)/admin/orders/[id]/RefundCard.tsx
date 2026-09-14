"use client";

import { useActionState, useState } from "react";
import type { AdminOrderDetail } from "@/lib/ordersAdmin";
import { formatDateTime, stripePaymentUrl } from "../format";
import { markRefundedAction, type RefundActionState } from "./actions";

const initial: RefundActionState = {};

export function RefundCard({ order }: { order: AdminOrderDetail }) {
  const [state, formAction, pending] = useActionState(markRefundedAction, initial);
  const [armed, setArmed] = useState(false);
  // Matches `markRefunded`'s own allowed-from set in src/lib/orders.ts: any
  // post-payment status a full refund could reasonably arrive during,
  // shipped or picked-up alike.
  const canRefund =
    order.status === "paid" ||
    order.status === "fulfilled" ||
    order.status === "ready_for_pickup" ||
    order.status === "picked_up";

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Refund</h2>
      <p className="adm-notice">Refunds are issued in Stripe so the money trail stays theirs.</p>

      {order.stripePaymentIntentId && (
        <p style={{ marginTop: 10 }}>
          <a
            href={stripePaymentUrl(order.stripePaymentIntentId)}
            target="_blank"
            rel="noreferrer"
            className="adm-btn"
          >
            Open in Stripe →
          </a>
        </p>
      )}

      {order.status === "refunded" ? (
        <p className="adm-notice" style={{ marginTop: 10 }}>
          Refunded{order.refundedAt ? ` · ${formatDateTime(order.refundedAt)}` : ""}
        </p>
      ) : (
        canRefund && (
          <form action={formAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              className="adm-btn adm-btn-danger"
              disabled={pending}
              onClick={(e) => {
                if (!armed) {
                  e.preventDefault();
                  setArmed(true);
                }
              }}
            >
              {pending ? "Marking…" : armed ? "Really mark refunded?" : "Mark refunded"}
            </button>
            {state?.error && (
              <p className="adm-error" role="alert">
                {state.error}
              </p>
            )}
          </form>
        )
      )}
    </div>
  );
}
