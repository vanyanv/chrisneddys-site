import Image from "next/image";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/catering/orders";
import { getPublicCateringConfig } from "@/lib/catering/public";
import { formatCents, formatDate, formatDateTime, storeName } from "../../format";
import { PrintButton } from "./PrintButton";
import "@/styles/admin-rack.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

const STATUS_LABEL: Record<string, string> = {
  requested: "Awaiting approval",
  booked: "Paid in full",
  completed: "Paid in full",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** The invoice (O4/A3's "Invoice" button) — same content whether the
 * customer reaches it from their order link or the owner reaches it here. */
export default async function CateringInvoicePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [order, publicConfig] = await Promise.all([getOrderById(id), getPublicCateringConfig()]);
  if (!order) notFound();

  const store = publicConfig.stores.find((s) => s.id === order.store);
  const isPaid = order.status === "booked" || order.status === "completed";
  const paidCents = order.totalCents - order.refundedCents;
  const balanceDue = isPaid ? 0 : order.totalCents;

  const eventMs = order.eventAt.getTime();
  const freeUntil = new Date(eventMs - 48 * 60 * 60 * 1000);
  const halfUntil = new Date(eventMs - 24 * 60 * 60 * 1000);

  return (
    <div className="rack-slip-page">
      <div className="rack-slip-noprint">
        <PrintButton />
      </div>

      <div className="rack-slip-sheet">
        <header className="rack-slip-top">
          <div>
            <Image
              src="/cne-logo-2x.webp"
              alt="Chris N Eddy's"
              width={309}
              height={87}
              className="rack-slip-logo"
              priority
            />
            <div className="rack-slip-addr">
              CHRIS N EDDY&rsquo;S &middot; {storeName(order.store).toUpperCase()}
              {store && (
                <>
                  <br />
                  {store.address}, {store.city} {store.zip}
                  <br />
                  {store.phone}
                </>
              )}
            </div>
          </div>
          <div>
            <div className="rack-bow rack-slip-title">INVOICE</div>
            <div className="rack-slip-number">{order.number}</div>
            <div className="rack-slip-date">
              {(STATUS_LABEL[order.status] ?? order.status).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="rack-slip-grid">
          <div>
            <div className="rack-eyebrow" style={{ marginBottom: 9 }}>
              Bill to
            </div>
            <address className="rack-slip-address">
              {order.company || order.contactName}
              <br />
              {order.company && (
                <>
                  Attn: {order.contactName}
                  <br />
                </>
              )}
              {order.contactEmail}
              <br />
              {order.contactPhone}
              {order.poNumber && (
                <>
                  <br />
                  PO {order.poNumber}
                </>
              )}
            </address>
          </div>
          <div>
            <div className="rack-eyebrow" style={{ marginBottom: 9 }}>
              {order.fulfilment === "delivery" ? "Delivered to" : "Pickup"}
            </div>
            <div className="rack-slip-address">
              {formatDateTime(order.eventAt)}
              <br />
              {order.fulfilment === "delivery" && order.address ? (
                <>
                  {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ""}
                  <br />
                  {order.address.city}, {order.address.state} {order.address.zip}
                  {order.distanceMiles !== null && !order.rangeUnknown && (
                    <> &middot; {order.distanceMiles} mi</>
                  )}
                </>
              ) : (
                store && `${store.address}, ${store.city} ${store.zip}`
              )}
            </div>
          </div>
        </div>

        <div className="rack-slip-items">
          <div className="rack-eyebrow" style={{ marginBottom: 15 }}>
            {order.headcount} people &middot; {order.items.length} line item
            {order.items.length === 1 ? "" : "s"}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rack-ink)" }}>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>#</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Qty</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Item &amp; choices</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>For</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>Each</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--rack-rule)" }}>
                  <td style={{ padding: "8px 6px", verticalAlign: "top" }}>{i + 1}</td>
                  <td style={{ padding: "8px 6px", verticalAlign: "top" }}>{item.qty}</td>
                  <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
                    <strong>{item.itemName}</strong>
                    <div style={{ color: "var(--rack-muted)", fontSize: 12 }}>
                      {[item.wayLabel, ...item.toppingLabels].filter(Boolean).join(", ")}
                      {item.extraLabels.length > 0 && <> &middot; {item.extraLabels.join(", ")}</>}
                    </div>
                    {item.note && (
                      <div
                        style={{ fontStyle: "italic", fontSize: 12, color: "var(--rack-muted)" }}
                      >
                        Note: {item.note}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "8px 6px", verticalAlign: "top", fontStyle: "italic" }}>
                    {item.forName ?? "Group"}
                  </td>
                  <td style={{ padding: "8px 6px", verticalAlign: "top", textAlign: "right" }}>
                    {formatCents(item.unitCents)}
                  </td>
                  <td style={{ padding: "8px 6px", verticalAlign: "top", textAlign: "right" }}>
                    {formatCents(item.amountCents)}
                  </td>
                </tr>
              ))}
              {order.plateSets > 0 && (
                <tr style={{ borderBottom: "1px solid var(--rack-rule)" }}>
                  <td style={{ padding: "8px 6px" }}>{order.items.length + 1}</td>
                  <td style={{ padding: "8px 6px" }}>{order.plateSets}</td>
                  <td style={{ padding: "8px 6px" }}>Plates, napkins, utensil sets</td>
                  <td style={{ padding: "8px 6px", fontStyle: "italic" }}>Group</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>Free</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>Free</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rack-slip-grid cat-invoice-totals-grid" style={{ borderBottom: "none" }}>
          <div>
            <div className="rack-eyebrow" style={{ marginBottom: 7 }}>
              Cancellation
            </div>
            <p style={{ fontSize: 12, color: "var(--rack-muted)", lineHeight: 1.6 }}>
              Free until {formatDateTime(freeUntil)}, half back until {formatDateTime(halfUntil)},
              no refund after.
            </p>
            <div className="rack-eyebrow" style={{ margin: "14px 0 7px" }}>
              Allergens
            </div>
            <p style={{ fontSize: 12, color: "var(--rack-muted)", lineHeight: 1.6 }}>
              Made in a shared kitchen with a shared griddle and fryer. Halal items use halal beef
              on a separate spot.
            </p>
          </div>
          <dl className="adm-status-list">
            <div>
              <dt>Food</dt>
              <dd className="adm-money">{formatCents(order.foodCents)}</dd>
            </div>
            {order.fulfilment === "delivery" && (
              <div>
                <dt>Delivery</dt>
                <dd className="adm-money">{formatCents(order.deliveryCents)}</dd>
              </div>
            )}
            <div>
              <dt>Sales tax</dt>
              <dd className="adm-money">{formatCents(order.taxCents)}</dd>
            </div>
            <div>
              <dt>Tip for the crew</dt>
              <dd className="adm-money">{formatCents(order.tipCents)}</dd>
            </div>
            <div className="ord-total-row">
              <dt>Total</dt>
              <dd className="adm-money">{formatCents(order.totalCents)}</dd>
            </div>
            {isPaid && (
              <div>
                <dt>Paid</dt>
                <dd className="adm-money">−{formatCents(paidCents)}</dd>
              </div>
            )}
            <div>
              <dt>
                <strong>Balance due</strong>
              </dt>
              <dd className="adm-money">
                <strong>{formatCents(balanceDue)}</strong>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rack-slip-footer">
          <div>
            <p style={{ fontSize: 16, fontWeight: 700 }}>Thanks for feeding the crew.</p>
            <p>Questions or changes: {store?.phone ?? ""} &middot; order link in your email.</p>
          </div>
          <div className="rack-slip-order-ref">
            {order.number} &middot; invoice date {formatDate(new Date())}
          </div>
        </div>
      </div>
    </div>
  );
}
