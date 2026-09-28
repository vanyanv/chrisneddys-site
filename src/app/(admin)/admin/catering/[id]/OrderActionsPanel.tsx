"use client";

/** The order detail page's "Next" card (A3/A4) — approve & charge, or the
 * decline-with-reason flow, for a `requested` order; a plain "Mark
 * completed" for a `booked` one whose event has passed. Nothing renders for
 * an order already settled (`completed`/`declined`/`expired`/`cancelled`) —
 * the timeline already says what happened. */
import { useActionState, useState } from "react";
import type { CateringOrderStatus } from "@/lib/catering/orders";
import { formatCents, formatCountdown, formatDateTime } from "../format";
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
  orderNumber,
  totalCents,
  respondBy,
  firstName,
}: {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  respondBy: Date | null;
  firstName: string;
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
          Decline {orderNumber}
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
            Reason ({firstName} sees it)
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
            Message to {firstName} (optional)
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
      {respondBy && (
        <p className="cat-next-sub">
          Expires in {formatCountdown(respondBy)}. Then the hold drops and {firstName} is told.
        </p>
      )}
      <p className="cat-next-sub">
        Approve charges the card on file and emails {firstName} the invoice. Decline cancels the
        hold and tells {firstName} why.
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
  orderNumber,
  status,
  hasPendingChange,
  totalCents,
  respondBy,
  contactName,
}: {
  orderId: string;
  orderNumber: string;
  status: CateringOrderStatus;
  hasPendingChange: boolean;
  totalCents: number;
  respondBy: Date | null;
  contactName: string;
}) {
  const firstName = contactName.trim().split(" ")[0] || "the customer";
  if (status === "requested" && !hasPendingChange) {
    return (
      <ApproveDecline
        orderId={orderId}
        orderNumber={orderNumber}
        totalCents={totalCents}
        respondBy={respondBy}
        firstName={firstName}
      />
    );
  }
  if (status === "booked" && !hasPendingChange) {
    return <MarkCompleted orderId={orderId} />;
  }
  return null;
}
