import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/catering-invoice.css";
import { getDb } from "@/db/client";
import { getOrderView } from "@/lib/catering/service";
import { CATERING_STORES } from "@/lib/catering/stores";
import { money } from "@/components/catering-order/money";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Order-link pages: never cache — must reflect live order state.
export const dynamic = "force-dynamic";

/** O4: the letter-size printable invoice, from the customer's order link. */
export default async function CateringInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const view = await getOrderView(db, token);
  if (!view.ok) notFound();
  const { order } = view;
  const storeName = CATERING_STORES.find((s) => s.id === order.store)?.name ?? order.store;
  const paid = order.status === "booked" || order.status === "completed";

  return (
    <div className="cinv-page">
      <PrintButton />
      <div className="cinv-sheet">
        <header className="cinv-head">
          <div>
            <p className="cinv-brand">Chris N Eddy&rsquo;s</p>
            <p className="cinv-meta">Chris N Eddy&rsquo;s &middot; {storeName}</p>
          </div>
          <div className="cinv-title">
            <h1>Invoice</h1>
            <p className="cinv-number">{order.number}</p>
            <span className={`cinv-badge is-${paid ? "paid" : "unpaid"}`}>
              {paid ? "Paid in full" : "Not yet charged"}
            </span>
          </div>
        </header>

        <div className="cinv-dates">
          <div>
            <span>Invoice date</span>
            <b>{new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}</b>
          </div>
          <div>
            <span>Ordered</span>
            <b>
              {order.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </b>
          </div>
          <div>
            <span>Confirmed</span>
            <b>
              {order.approvedAt
                ? order.approvedAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Pending"}
            </b>
          </div>
          <div className="cinv-balance">
            <span>Balance due</span>
            <b>{money(paid ? 0 : order.totalCents)}</b>
          </div>
        </div>

        <div className="cinv-parties">
          <div>
            <p className="cinv-label">Bill to</p>
            <p>
              <b>{order.company || order.contactName}</b>
            </p>
            {order.company && <p>Attn: {order.contactName}</p>}
            <p>{order.contactEmail}</p>
            <p>{order.contactPhone}</p>
            {order.poNumber && <p>PO {order.poNumber}</p>}
          </div>
          <div>
            <p className="cinv-label">Delivered to</p>
            <p>
              {order.eventAt.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
            </p>
            {order.fulfilment === "delivery" && order.address ? (
              <>
                <p>{order.address.line1}</p>
                <p>
                  {order.address.city}, {order.address.state} {order.address.zip}
                </p>
              </>
            ) : (
              <p>Pickup at {storeName}</p>
            )}
          </div>
          <div>
            <p className="cinv-label">Order</p>
            <p>
              {order.items.length} line item{order.items.length === 1 ? "" : "s"}
            </p>
            {order.customerNote && <p className="cinv-note">&ldquo;{order.customerNote}&rdquo;</p>}
          </div>
        </div>

        <table className="cinv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Qty</th>
              <th>Item and choices</th>
              <th>For</th>
              <th>Each</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>{item.qty}</td>
                <td>
                  <b>{item.itemName}</b>
                  {(item.wayLabel || item.toppingLabels.length > 0) && (
                    <div className="cinv-fine">
                      {item.wayLabel ?? "Custom"}
                      {item.toppingLabels.length > 0
                        ? `: ${item.toppingLabels.join(", ")} (free)`
                        : ""}
                    </div>
                  )}
                  {item.extraLabels.length > 0 && (
                    <div className="cinv-fine">{item.extraLabels.join(", ")}</div>
                  )}
                  {item.note && <div className="cinv-fine">Note: {item.note}</div>}
                </td>
                <td>{item.forName ?? "Group"}</td>
                <td>{money(Math.round(item.unitCents))}</td>
                <td>{money(item.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cinv-foot">
          <div className="cinv-cancel">
            <p className="cinv-label">Cancellation</p>
            <p className="cinv-fine">
              Free 48 hours out, half back 24-48 hours out, no refund inside 24 hours.
            </p>
            <p className="cinv-label">Allergens</p>
            <p className="cinv-fine">Made in a shared kitchen with a shared griddle and fryer.</p>
          </div>
          <div className="cinv-totals">
            <p>
              <span>Food</span>
              <span>{money(order.foodCents)}</span>
            </p>
            {order.deliveryCents > 0 && (
              <p>
                <span>Delivery</span>
                <span>{money(order.deliveryCents)}</span>
              </p>
            )}
            <p>
              <span>Sales tax</span>
              <span>{money(order.taxCents)}</span>
            </p>
            {order.tipCents > 0 && (
              <p>
                <span>Tip for the crew</span>
                <span>{money(order.tipCents)}</span>
              </p>
            )}
            <p className="cinv-total">
              <span>Total</span>
              <span>{money(order.totalCents)}</span>
            </p>
            {paid && (
              <p>
                <span>Paid</span>
                <span>-{money(order.totalCents - order.refundedCents)}</span>
              </p>
            )}
            <p className="cinv-total">
              <span>Balance due</span>
              <span>{money(paid ? 0 : order.totalCents)}</span>
            </p>
          </div>
        </div>

        <p className="cinv-thanks">Thanks for feeding the crew.</p>
        <p className="cinv-fine">
          Questions or changes: chris@chrisneddys.com &middot; order link in your email
        </p>
      </div>
    </div>
  );
}
