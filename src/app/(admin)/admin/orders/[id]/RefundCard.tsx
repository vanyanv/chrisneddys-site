"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOrderDetail } from "@/lib/ordersAdmin";
import { formatDateTime } from "../format";
import { markRefundedAction, type RefundActionState } from "./actions";
import { OrderToast } from "./OrderToast";

const initial: RefundActionState = {};
const TOAST_MS = 4000;

export function RefundCard({ order }: { order: AdminOrderDetail }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(markRefundedAction, initial);
  const [armed, setArmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setToast("Marked refunded");
      // See `useActionToast` in FulfilmentCard.tsx: this card also reads
      // straight off the server-fetched `order` prop, so the pill needs an
      // explicit refresh to pick up the new status after the action.
      router.refresh();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), TOAST_MS);
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Matches `markRefunded`'s own allowed-from set in src/lib/orders.ts: any
  // post-payment status a full refund could reasonably arrive during,
  // shipped or picked-up alike.
  const canRefund =
    order.status === "paid" ||
    order.status === "fulfilled" ||
    order.status === "ready_for_pickup" ||
    order.status === "picked_up";

  return (
    <div className="ord-action-group">
      <p className="ord-action-heading">Refund</p>
      <p className="adm-notice">Refunds are issued in Stripe so the money trail stays theirs.</p>

      {order.status === "refunded" ? (
        <p className="adm-notice" style={{ marginTop: 10 }}>
          Refunded{order.refundedAt ? ` · ${formatDateTime(order.refundedAt)}` : ""}
        </p>
      ) : (
        canRefund && (
          <form action={formAction} className="ord-action-form" style={{ marginTop: 10 }}>
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              className={`ord-refund-btn${armed ? " is-armed" : ""}`}
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
              <p className="adm-field-error" role="alert">
                {state.error}
              </p>
            )}
          </form>
        )
      )}
      <OrderToast message={toast} />
    </div>
  );
}
