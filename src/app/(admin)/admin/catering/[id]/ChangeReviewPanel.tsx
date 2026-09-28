"use client";

/** The pending-change review card (O2's admin counterpart) — shown whenever
 * a `requested`/`booked` order carries a customer-submitted `pendingChange`.
 * Approving replaces the order's lines/totals with the change (and, per
 * phase 3, charges or refunds the difference); declining leaves the order
 * exactly as it was and tells the customer why. */
import { useActionState } from "react";
import type { CateringPendingChange } from "@/db/schema";
import { formatCents } from "../format";
import { approveChangeAction, declineChangeAction, type CateringActionState } from "./actions";
import { useRefreshOnSuccess } from "./useRefreshOnSuccess";

const initial: CateringActionState = {};

export function ChangeReviewPanel({
  orderId,
  pendingChange,
  currentTotalCents,
}: {
  orderId: string;
  pendingChange: CateringPendingChange;
  currentTotalCents: number;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveChangeAction,
    initial,
  );
  const [declineState, declineActionFn, declinePending] = useActionState(
    declineChangeAction,
    initial,
  );
  useRefreshOnSuccess(approvePending, approveState?.error);
  useRefreshOnSuccess(declinePending, declineState?.error);

  const diff = pendingChange.totalCents - currentTotalCents;

  return (
    <div className="cat-change-card">
      <p className="rack-eyebrow">Pending change</p>
      <p className="cat-next-heading">
        {pendingChange.lines.length} line{pendingChange.lines.length === 1 ? "" : "s"} · headcount{" "}
        {pendingChange.plateSets}
      </p>
      <div className="cat-change-diff">
        New total {formatCents(pendingChange.totalCents)} (was {formatCents(currentTotalCents)}) —{" "}
        {diff > 0
          ? `charges ${formatCents(diff)} more to the card on file`
          : diff < 0
            ? `refunds ${formatCents(-diff)}`
            : "no change in total"}
        .
      </div>

      {(approveState?.error || declineState?.error) && (
        <p className="adm-error" role="alert">
          {approveState?.error ?? declineState?.error}
        </p>
      )}

      <div className="cat-change-actions">
        <form action={approveAction} style={{ flex: 1 }}>
          <input type="hidden" name="orderId" value={orderId} />
          <button type="submit" className="cat-btn-approve" disabled={approvePending}>
            {approvePending ? "Approving…" : "Approve change"}
          </button>
        </form>
        <form action={declineActionFn} style={{ flex: 1 }}>
          <input type="hidden" name="orderId" value={orderId} />
          <button type="submit" className="cat-btn-decline" disabled={declinePending}>
            {declinePending ? "Declining…" : "Decline change"}
          </button>
        </form>
      </div>
    </div>
  );
}
