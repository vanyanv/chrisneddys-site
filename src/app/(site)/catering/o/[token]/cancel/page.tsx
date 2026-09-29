import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/catering-order.css";
import { getDb } from "@/db/client";
import { getOrderView } from "@/lib/catering/service";
import { CancelPanel } from "./CancelPanel";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Order-link pages: never cache — must reflect live order state.
export const dynamic = "force-dynamic";

/** O3: cancel, with the exact refund tier for right now. */
export default async function CateringCancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const view = await getOrderView(db, token);
  if (!view.ok || !view.canCancel) notFound();

  return (
    <div className="cor-order-link">
      <CancelPanel
        token={token}
        number={view.order.number}
        totalCents={view.order.totalCents}
        cancellationQuote={view.cancellationQuote}
        eventAt={view.order.eventAt.toISOString()}
      />
    </div>
  );
}
