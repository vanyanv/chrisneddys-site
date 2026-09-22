import Image from "next/image";
import { notFound } from "next/navigation";
import { getOrderForAdmin } from "@/lib/ordersAdmin";
import { getStoreSettings } from "@/lib/orders";
import { formatDateTime } from "../../format";
import { PrintButton } from "./PrintButton";
import "@/styles/admin-rack.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Print-styled packing slip (`PackingSlip.dc.html`, issue #36 phase 4).
 * Deliberately renders no admin chrome at all — no top bar, no tabs — this
 * is a print sheet, not a screen with navigation; `@media print` in
 * `admin-rack.css` hides everything but `.rack-slip-sheet` besides. Each
 * item's edition badge only appears when the item actually carries one —
 * "Number X of Y" is real inventory data (`editionNumber`/the variant's
 * `editionSize`, projected onto `AdminOrderItem` by `getOrderForAdmin` in
 * `src/lib/ordersAdmin.ts`), not decoration, so a non-numbered item (an
 * untracked or count-mode product) gets none rather than a made-up one.
 * Item photos aren't shown: `getOrderForAdmin` doesn't join back to the
 * product's image, only its name/sku/edition, so there's nothing real to
 * put in that spot — see this phase's report. */
export default async function PackingSlipPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  const settings = await getStoreSettings();
  const shipToLines: string[] =
    order.fulfilment === "pickup"
      ? [order.name ?? "Customer", `Pickup — ${settings.pickupAddress || "Address on file"}`]
      : order.shipTo
        ? [
            order.shipTo.name,
            order.shipTo.line1,
            ...(order.shipTo.line2 ? [order.shipTo.line2] : []),
            `${order.shipTo.city}, ${order.shipTo.state} ${order.shipTo.postalCode}`,
            order.shipTo.country,
          ]
        : [order.name ?? "Customer"];

  const numberedItems = order.items.filter((item) => item.editionNumber !== null);
  const soleNumberedItem = numberedItems.length === 1 ? numberedItems[0] : null;

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
              alt={settings.storeName}
              width={309}
              height={87}
              className="rack-slip-logo"
              priority
            />
            <div className="rack-slip-addr">{settings.storeName.toUpperCase()}</div>
          </div>
          <div>
            <div className="rack-bow rack-slip-title">PACKING SLIP</div>
            <div className="rack-slip-number">{order.number}</div>
            <div className="rack-slip-date">{formatDateTime(order.createdAt).toUpperCase()}</div>
          </div>
        </header>

        <div className="rack-slip-grid">
          <div>
            <div className="rack-eyebrow" style={{ marginBottom: 9 }}>
              {order.fulfilment === "pickup" ? "Pickup" : "Ship to"}
            </div>
            <address className="rack-slip-address">
              {shipToLines.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < shipToLines.length - 1 && <br />}
                </span>
              ))}
            </address>
          </div>
          <div>
            <div className="rack-eyebrow" style={{ marginBottom: 9 }}>
              Method
            </div>
            <div className="rack-slip-address">
              {order.fulfilment === "pickup" ? "In-store pickup" : order.carrier || "Shipping"}
              <br />
              Ordered {formatDateTime(order.createdAt)}
            </div>
          </div>
        </div>

        <div className="rack-slip-items">
          <div className="rack-eyebrow" style={{ marginBottom: 15 }}>
            What&rsquo;s in the box
          </div>
          {order.items.map((item) => (
            <div key={item.id} className="rack-slip-item">
              <div
                className="rack-slip-item-thumb"
                aria-hidden="true"
                style={{
                  width: 64,
                  height: 64,
                  background: "var(--rack-cream)",
                  flex: "none",
                }}
              />
              <div style={{ flex: 1 }}>
                <div className="rack-slip-item-name">{item.productName}</div>
                <div className="rack-slip-item-meta">{item.variantLabel.toUpperCase()}</div>
              </div>
              {item.editionNumber && (
                <div className="rack-slip-edition">
                  <div className="rack-eyebrow">Number</div>
                  <div className="rack-bow rack-mono rack-slip-edition-num">
                    {item.editionNumber}
                    {item.editionSize && <span>/{item.editionSize}</span>}
                  </div>
                </div>
              )}
              <div className="rack-slip-qty">× {item.quantity}</div>
            </div>
          ))}
        </div>

        {numberedItems.length > 0 && (
          <div className="rack-slip-callout">
            <div className="rack-bow" style={{ fontSize: 19 }}>
              {soleNumberedItem
                ? `Number ${soleNumberedItem.editionNumber}${
                    soleNumberedItem.editionSize ? ` of ${soleNumberedItem.editionSize}` : ""
                  }. That's yours.`
                : "Those numbers are yours."}
            </div>
            <p>No restock and no second run, so this number belongs to one item and one person.</p>
          </div>
        )}

        <div className="rack-slip-footer">
          <div>
            <div className="rack-eyebrow" style={{ marginBottom: 7 }}>
              Something wrong?
            </div>
            <p>
              Email <strong>{settings.supportEmail}</strong> with the order number.
              {settings.returnsPolicy && (
                <>
                  <br />
                  {settings.returnsPolicy}
                </>
              )}
            </p>
          </div>
          <div className="rack-slip-order-ref">
            {order.number} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </div>
  );
}
