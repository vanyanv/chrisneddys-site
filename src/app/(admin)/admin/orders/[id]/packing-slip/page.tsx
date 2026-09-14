import { notFound } from "next/navigation";
import { getOrderForAdmin } from "@/lib/ordersAdmin";
import { getStoreSettings } from "@/lib/orders";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Print-styled packing slip — `@media print` in `admin.css` hides the rest
 * of the admin chrome (topbar, sidebar, this page's own Print button) so
 * only `.adm-slip-sheet` prints. */
export default async function PackingSlipPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  const settings = await getStoreSettings();

  return (
    <div className="adm-slip">
      <div className="adm-slip-noprint">
        <PrintButton />
      </div>

      <div className="adm-slip-sheet">
        <header className="adm-slip-head">
          <span className="adm-slip-store">{settings.storeName}</span>
          <span className="adm-slip-number">{order.number}</span>
        </header>

        <div className="adm-slip-to">
          <span className="adm-label">Ship to</span>
          {order.fulfilment === "pickup" ? (
            <p>
              {order.name ?? "Customer"}
              <br />
              Pickup — {settings.pickupAddress}
            </p>
          ) : order.shipTo ? (
            <p>
              {order.shipTo.name}
              <br />
              {order.shipTo.line1}
              <br />
              {order.shipTo.line2 && (
                <>
                  {order.shipTo.line2}
                  <br />
                </>
              )}
              {order.shipTo.city}, {order.shipTo.state} {order.shipTo.postalCode}
              <br />
              {order.shipTo.country}
            </p>
          ) : (
            <p>{order.name ?? "Customer"}</p>
          )}
        </div>

        <table className="adm-slip-items">
          <thead>
            <tr>
              <th>Item</th>
              <th>Edition</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td>{item.editionNumber ? `#${item.editionNumber}` : "—"}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="adm-slip-thanks">Thanks for securing your number.</p>
      </div>
    </div>
  );
}
