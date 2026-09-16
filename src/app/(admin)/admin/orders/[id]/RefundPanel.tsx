"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminOrderDetail } from "@/lib/ordersAdmin";
import { formatCents, formatDateTime } from "../format";
import { markRefundedAction, type RefundActionState } from "./actions";

const initial: RefundActionState = {};
const TOAST_MS = 4000;

/** "12" / "12 and 13" / "12, 13 and 14" — duplicated from `email.ts`'s own
 * `formatNumberList` rather than shared, since this is a client component
 * and that module is `server-only`. */
function formatNumberList(numbers: number[]): string {
  if (numbers.length === 1) return `${numbers[0]}`;
  if (numbers.length === 2) return `${numbers[0]} and ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

/**
 * The one confirm in the store (`Refund.dc.html`) — a refund is the one
 * action here Stripe won't let anyone undo, so unlike every other order
 * action (which fires immediately and relies on a toast for "undo"), this
 * asks before it acts. Replaces the old inline arm/confirm button
 * (`RefundCard.tsx`, issue #32) with a real confirm step, per this phase's
 * brief.
 *
 * Carries the two things a bare "mark refunded" can't decide on its own
 * (issue #42): a "put number N back in the run" toggle, off by default —
 * see `markRefunded` in `src/lib/orders.ts` for why release is never
 * inferred from the refund itself — and an optional reason, filed as an
 * order note (`appendOrderNote`) that the customer never sees. Both are
 * skipped entirely when the order has no numbered items to release (a
 * plain-quantity product has no per-unit number for the toggle to name).
 *
 * The refund itself always happens in Stripe first, same as the button
 * this replaces — `markRefundedAction` only marks the order here to match
 * reality and fires `sendRefundConfirmation` (issue #36, commit
 * f2cf447), which is why the copy below says "once this is marked
 * refunded" rather than claiming this button moves money.
 */
export function RefundTrigger({ order }: { order: AdminOrderDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(markRefundedAction, initial);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
      setToast("Marked refunded");
      // `RefundPanel`/this trigger read straight off the server-fetched
      // `order` prop (same reasoning as `FulfilmentCard`'s
      // `useActionCompletion`), so the pill needs an explicit refresh.
      router.refresh();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open]);

  // Matches `markRefunded`'s own allowed-from set in src/lib/orders.ts: any
  // post-payment status a full refund could reasonably arrive during,
  // shipped or picked-up alike.
  const canRefund =
    order.status === "paid" ||
    order.status === "fulfilled" ||
    order.status === "ready_for_pickup" ||
    order.status === "picked_up";

  if (order.status === "refunded") {
    return (
      <span className="ord-refunded-note">
        Refunded{order.refundedAt ? ` · ${formatDateTime(order.refundedAt)}` : ""}
      </span>
    );
  }
  if (!canRefund) return null;

  const customer = order.name ?? order.email ?? "Guest";

  // Only edition products have a number to put back — a plain-quantity item
  // has nothing for the toggle to name, so it's simply not offered.
  const editionNumbers = order.items
    .map((item) => item.editionNumber)
    .filter((n): n is number => n !== null);
  const numberWord = editionNumbers.length === 1 ? "number" : "numbers";
  const pronoun = editionNumbers.length === 1 ? "it" : "them";

  return (
    <>
      <button type="button" className="rack-btn" onClick={() => setOpen(true)}>
        Refund {formatCents(order.totalCents)}
      </button>

      {open && (
        <div className="rack-refund-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="rack-refund-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rack-refund-head">
              <div>
                <span className="rack-eyebrow">
                  {order.number} · {customer}
                </span>
                <h3 id="refund-heading" className="rack-bow rack-refund-title">
                  Refund this order.
                </h3>
              </div>
              <button
                type="button"
                className="rack-btn rack-refund-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <p className="rack-refund-amount rack-mono">{formatCents(order.totalCents)}</p>

            <div className="adm-field rack-refund-reason">
              <label htmlFor="refund-reason" className="adm-label">
                Reason — {customer} never sees this
              </label>
              <input
                id="refund-reason"
                name="reason"
                type="text"
                form="refund-confirm-form"
                className="adm-input"
                placeholder="Optional, for the desk only"
                disabled={pending}
              />
            </div>

            {editionNumbers.length > 0 && (
              <div className="rack-refund-release">
                {editionNumbers.length === 1 && (
                  <span className="rack-refund-release-badge rack-mono rack-bow" aria-hidden="true">
                    {editionNumbers[0]}
                  </span>
                )}
                <div className="rack-refund-release-copy">
                  <label htmlFor="refund-release" className="rack-refund-release-title">
                    Put {numberWord} {formatNumberList(editionNumbers)} back in the run
                  </label>
                  <p className="rack-refund-release-help">
                    It goes back to available and the next buyer can take {pronoun}. Leave this off
                    if {editionNumbers.length === 1 ? "it isn't" : "they aren't"} coming back.
                  </p>
                </div>
                <span className="rack-refund-release-toggle">
                  <input
                    id="refund-release"
                    name="release"
                    type="checkbox"
                    form="refund-confirm-form"
                    className="rack-refund-release-input"
                    disabled={pending}
                  />
                  <span className="rack-refund-release-track" aria-hidden="true">
                    <span className="rack-refund-release-thumb" />
                  </span>
                </span>
              </div>
            )}

            <div className="rack-refund-box">
              <span className="rack-eyebrow">What happens</span>
              <p>
                Refunds are issued in Stripe first — this only marks the order here so the desk
                matches reality. Once it does, {customer} gets a confirmation email saying the
                refund is on its way.
              </p>
            </div>

            <div className="rack-refund-warning">
              <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
                <path d="M8 5v4M8 11.2v.1" />
                <circle cx="8" cy="8" r="6" />
              </svg>
              <p>
                <strong>This one has no undo.</strong> Stripe won&rsquo;t reverse a refund, so
                confirm you&rsquo;ve already issued it there before marking it here.
              </p>
            </div>

            <form action={formAction} className="rack-refund-actions" id="refund-confirm-form">
              <input type="hidden" name="orderId" value={order.id} />
              <button
                type="button"
                className="rack-btn"
                style={{ flex: 1 }}
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Keep the order
              </button>
              <button
                type="submit"
                className="rack-refund-confirm"
                style={{ flex: 1.4 }}
                disabled={pending}
              >
                {pending ? "Marking…" : `Mark refunded`}
              </button>
            </form>
            {state?.error && (
              <p className="adm-field-error" role="alert">
                {state.error}
              </p>
            )}
          </div>
        </div>
      )}

      <div className={`adm-toast${toast ? " is-visible" : ""}`} role="status" aria-live="polite">
        <span>{toast ?? ""}</span>
      </div>
    </>
  );
}
