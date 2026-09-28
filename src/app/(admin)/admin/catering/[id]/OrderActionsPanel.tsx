"use client";

/** The order detail page's "Next" card (A3/A4) — approve & charge, or the
 * decline-with-reason flow, for a `requested` order; a plain "Mark
 * completed" for a `booked` one whose event has passed. Nothing renders for
 * an order already settled (`completed`/`declined`/`expired`/`cancelled`) —
 * the timeline already says what happened. */
import { useActionState, useState } from "react";
import type { CateringOrderStatus } from "@/lib/catering/orders";
import { formatCents, formatDateTime } from "../format";
import {
  DECLINE_REASONS,
  approveOrderAction,
  declineOrderAction,
  markCompletedAction,
  type CateringActionState,
} from "./actions";

const initial: CateringActionState = {};

function ApproveDecline({
  orderId,
  totalCents,
  respondBy,
}: {
  orderId: string;
  totalCents: number;
  respondBy: Date | null;
}) {
  const [declining, setDeclining] = useState(false);
  const [reasonKind, setReasonKind] = useState<(typeof DECLINE_REASONS)[number]>(
    DECLINE_REASONS[0],
  );
  const [approveState, approveAction, approvePending] = useActionState(approveOrderAction, initial);
  const [declineState, declineActionFn, declinePending] = useActionState(
    declineOrderAction,
    initial,
  );

  if (declining) {
    return (
      <div className="cat-next-card">
        <p className="rack-eyebrow" style={{ marginBottom: 6 }}>
          Decline this order
        </p>
        {declineState?.error && (
          <p className="adm-error" role="alert">
            {declineState.error}
          </p>
        )}
        <form action={declineActionFn}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="reasonKind" value={reasonKind} />
          <p className="rack-eyebrow" style={{ marginBottom: 6 }}>
            Reason (the customer sees it)
          </p>
          <div className="cat-decline-reasons">
            {DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className={`cat-decline-reason${reasonKind === reason ? " is-selected" : ""}`}
                onClick={() => setReasonKind(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
          <label className="adm-label" htmlFor="message">
            Message to the customer (optional)
          </label>
          <textarea id="message" name="message" className="adm-textarea" rows={3} />
          <button type="submit" className="cat-btn-danger" disabled={declinePending}>
            {declinePending ? "Declining…" : "Decline & release the hold"}
          </button>
          <button
            type="button"
            className="cat-btn-decline"
            style={{ marginTop: 8 }}
            onClick={() => setDeclining(false)}
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="cat-next-card">
      <p className="rack-eyebrow">Next</p>
      <p className="cat-next-heading">
        {respondBy ? `Approve by ${formatDateTime(respondBy)}` : "Awaiting your reply"}
      </p>
      <p className="cat-next-sub">
        Approve charges the card on file and emails the invoice. Decline cancels the hold and tells
        the customer why.
      </p>
      {approveState?.error && (
        <p className="adm-error" role="alert">
          {approveState.error}
        </p>
      )}
      <form action={approveAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <button type="submit" className="cat-btn-approve" disabled={approvePending}>
          {approvePending ? "Approving…" : `Approve & charge ${formatCents(totalCents)}`}
        </button>
      </form>
      <button type="button" className="cat-btn-decline" onClick={() => setDeclining(true)}>
        Decline
      </button>
    </div>
  );
}

function MarkCompleted({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(markCompletedAction, initial);
  return (
    <div className="cat-next-card">
      <p className="rack-eyebrow">Next</p>
      <p className="cat-next-sub">Booked. Mark it completed once the crew&apos;s sent it out.</p>
      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}
      <form action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <button type="submit" className="cat-btn-approve" disabled={pending}>
          {pending ? "Marking…" : "Mark completed"}
        </button>
      </form>
    </div>
  );
}

export function OrderActionsPanel({
  orderId,
  status,
  hasPendingChange,
  totalCents,
  respondBy,
}: {
  orderId: string;
  status: CateringOrderStatus;
  hasPendingChange: boolean;
  totalCents: number;
  respondBy: Date | null;
}) {
  if (status === "requested" && !hasPendingChange) {
    return <ApproveDecline orderId={orderId} totalCents={totalCents} respondBy={respondBy} />;
  }
  if (status === "booked" && !hasPendingChange) {
    return <MarkCompleted orderId={orderId} />;
  }
  return null;
}
