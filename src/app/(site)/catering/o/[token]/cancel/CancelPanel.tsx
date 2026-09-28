"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CancellationQuote } from "@/lib/catering/types";
import { money } from "@/components/catering-order/money";
import { cancelOrderAction } from "../actions";

/** O3: the cancel confirmation, with the tier for right now — mirrors the
 * three tiers (free / half / none) so the customer sees where "now" falls. */
export function CancelPanel({
  token,
  number,
  totalCents,
  cancellationQuote,
  eventAt,
}: {
  token: string;
  number: string;
  totalCents: number;
  cancellationQuote: CancellationQuote;
  eventAt: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const eventDate = new Date(eventAt);
  const freeUntil = new Date(eventDate.getTime() - 48 * 60 * 60 * 1000);
  const halfUntil = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  async function onCancel() {
    setBusy(true);
    setError(null);
    const result = await cancelOrderAction(token);
    setBusy(false);
    if (result.ok) {
      setDone(true);
    } else {
      setError(result.error);
    }
  }

  if (done) {
    return (
      <section className="cor-link-hero">
        <p className="cor-link-tag">Cancel {number}</p>
        <h1>Cancelled.</h1>
        <p>Your refund of {money(cancellationQuote.refundCents)} is on its way.</p>
      </section>
    );
  }

  return (
    <section className="cor-link-hero">
      <p className="cor-link-tag">Cancel {number}</p>
      <h1>
        {cancellationQuote.tier === "free"
          ? `You get all ${money(totalCents)} back.`
          : cancellationQuote.tier === "half"
            ? `You get ${money(cancellationQuote.refundCents)} back.`
            : "You get nothing back."}
      </h1>
      <p>Refunds land in 5 to 10 business days.</p>
      <div className="cor-tier-strip">
        <span className={cancellationQuote.tier === "free" ? "is-current" : ""}>
          All back
          <br />
          until {fmt(freeUntil)}
        </span>
        <span className={cancellationQuote.tier === "half" ? "is-current" : ""}>
          Half back
          <br />
          until {fmt(halfUntil)}
        </span>
        <span className={cancellationQuote.tier === "none" ? "is-current" : ""}>
          Nothing back
          <br />
          after that
        </span>
      </div>
      {error && <p className="cor-note is-error">{error}</p>}
      <button type="button" className="cor-btn is-danger" onClick={onCancel} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel my order"}
      </button>
      <button type="button" className="cor-btn is-secondary" onClick={() => router.back()}>
        Keep it
      </button>
    </section>
  );
}
