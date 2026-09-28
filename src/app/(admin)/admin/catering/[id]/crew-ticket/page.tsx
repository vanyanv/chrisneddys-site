import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/catering/orders";
import {
  driverLeavesMs,
  groupForCrew,
  readyByMs,
  stationCounts,
  toppingById,
  wayLabel,
  type CartLine,
  type CrewBuild,
} from "@/lib/catering";
import { formatDate, formatDateTime, formatTime, fulfilmentLabel, storeName } from "../../format";
import { PrintButton } from "./PrintButton";
import "@/styles/admin-rack.css";
import "@/styles/admin-catering.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

function buildLabel(build: CrewBuild): string {
  if (!build.wayId || build.wayId === "custom") return "Custom";
  return wayLabel(build.wayId);
}

/**
 * The crew ticket (A5) — the owner's own override of the wireframe's
 * station-totals-first layout: "show it per order … it can be multiple
 * pages" (see `docs/catering-build-plan.md`'s crew-ticket ground rule). This
 * leads with times and who/where, then the make list grouped by item and
 * exact build (`groupForCrew`), then named orders, and only then a small
 * station-totals box — the reverse of the wireframe's own order, which put
 * raw patty/topping counts first.
 */
export default async function CrewTicketPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const lines: CartLine[] = order.items.map((item) => ({
    itemId: item.itemId,
    qty: item.qty,
    wayId: (item.wayId as CartLine["wayId"]) ?? null,
    toppings: item.toppings,
    extras: item.extras,
    forName: item.forName ?? undefined,
    note: item.note ?? undefined,
  }));

  const groups = groupForCrew(lines);
  const station = stationCounts(lines);
  const eventMs = order.eventAt.getTime();
  const readyBy = new Date(readyByMs(eventMs));
  const driverLeaves = order.fulfilment === "delivery" ? new Date(driverLeavesMs(eventMs)) : null;

  const namedItems = order.items.filter((item) => item.forName);

  const toppingEntries: [string, number][] = Object.entries(station.toppings).map(
    ([id, n]) => [toppingById(id)?.name ?? id, n] as [string, number],
  );
  const stationEntries: [string, number][] = (
    [
      ["Patties", station.patties],
      ["Halal patties · own spot", station.halalPatties],
      ["Cheese slices", station.cheeseSlices],
      ["Rolls", station.rolls],
      ["Fries", station.fries],
      ["Shakes", station.shakes],
      ["Extra sauce cups", station.sauceCups],
      ...toppingEntries,
    ] as [string, number][]
  ).filter(([, n]) => n > 0);

  return (
    <div className="rack-slip-page">
      <div className="rack-slip-noprint">
        <PrintButton />
      </div>

      <div className="rack-slip-sheet" style={{ padding: 0, gap: 0 }}>
        <div className="cat-ticket-band">
          <span>Crew ticket</span>
          <span>{order.number}</span>
          <span>
            {fulfilmentLabel(order.fulfilment)} &middot; {storeName(order.store)}
          </span>
        </div>

        <div className="cat-times-row">
          <div className="cat-times-cell">
            <div className="cat-times-label">Day</div>
            <div className="cat-times-value">{formatDate(order.eventAt)}</div>
          </div>
          <div className="cat-times-cell is-highlight">
            <div className="cat-times-label">Ready by</div>
            <div className="cat-times-value">{formatTime(readyBy)}</div>
          </div>
          {driverLeaves && (
            <div className="cat-times-cell">
              <div className="cat-times-label">Driver leaves</div>
              <div className="cat-times-value">{formatTime(driverLeaves)}</div>
            </div>
          )}
          <div className="cat-times-cell">
            <div className="cat-times-label">
              {order.fulfilment === "delivery" ? "Deliver at" : "Pickup at"}
            </div>
            <div className="cat-times-value">{formatTime(order.eventAt)}</div>
          </div>
        </div>

        <div style={{ padding: "0 20px" }}>
          <div className="cat-who-grid">
            <div>
              <div className="rack-eyebrow">For</div>
              <div>
                {order.company || order.contactName} &middot; {order.headcount} people
              </div>
              <div>
                {order.contactName} ({order.contactPhone})
              </div>
            </div>
            <div>
              <div className="rack-eyebrow">
                {order.fulfilment === "delivery" ? "Deliver to" : "Pickup"}
              </div>
              {order.fulfilment === "delivery" && order.address ? (
                <>
                  <div>
                    {order.address.line1}
                    {order.address.line2 ? `, ${order.address.line2}` : ""}
                    {order.distanceMiles !== null && !order.rangeUnknown && (
                      <> &middot; {order.distanceMiles} mi</>
                    )}
                  </div>
                  {(order.onsiteContactName || order.onsiteContactPhone) && (
                    <div>
                      On site: {order.onsiteContactName} {order.onsiteContactPhone}
                      {order.address.instructions && <> &middot; {order.address.instructions}</>}
                    </div>
                  )}
                </>
              ) : (
                <div>{storeName(order.store)}</div>
              )}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.itemId} className="cat-make-list-group">
              <div className="cat-make-list-heading">
                <h3>{group.itemName}</h3>
                <span className="cat-make-list-count">× {group.totalCount}</span>
              </div>
              {group.builds.map((build, i) => (
                <div key={i} className={`cat-build-row${build.halal ? " is-halal" : ""}`}>
                  <span className="cat-build-checkbox" aria-hidden="true" />
                  <span className="cat-build-count">{build.count}</span>
                  <div className="cat-build-body">
                    <div className="cat-build-line">{buildLabel(build)}</div>
                    {build.toppingLabels.length > 0 && (
                      <div className="cat-build-detail">{build.toppingLabels.join(", ")}</div>
                    )}
                    {build.extraLabels.length > 0 && (
                      <div className="cat-build-detail is-halal-label">
                        {build.extraLabels.join(" · ")}
                      </div>
                    )}
                    {build.names.length > 0 && (
                      <div className="cat-build-names">For {build.names.join(", ")}</div>
                    )}
                    {build.notes.length > 0 && (
                      <div className="cat-build-names">&ldquo;{build.notes.join("; ")}&rdquo;</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {namedItems.length > 0 && (
            <div className="cat-named-orders">
              <div className="rack-eyebrow" style={{ marginBottom: 8 }}>
                Named orders · bag and label each one
              </div>
              <table className="cat-named-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Make</th>
                    <th>How</th>
                  </tr>
                </thead>
                <tbody>
                  {namedItems.map((item) => {
                    const halal = item.extraLabels.some((l) => /halal/i.test(l));
                    return (
                      <tr key={item.id} className={halal ? "is-halal" : ""}>
                        <td>{item.forName}</td>
                        <td>{item.itemName}</td>
                        <td>
                          {item.wayLabel ?? "Custom"}
                          {item.toppingLabels.length > 0 && <> · {item.toppingLabels.join(", ")}</>}
                          {item.extraLabels.length > 0 && <> · {item.extraLabels.join(", ")}</>}
                          {item.note && <> · {item.note}</>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {stationEntries.length > 0 && (
            <div className="cat-station-box">
              {stationEntries.map(([label, n]) => (
                <div key={label}>
                  <strong>{n}</strong> {label}
                </div>
              ))}
            </div>
          )}

          <div className="cat-signoff">
            <span>Made by _________</span>
            <span>Packed by _________</span>
            <span>Checked by _________</span>
            <span>Left at _________</span>
          </div>

          <div className="cat-ticket-footer">
            Printed {formatDateTime(new Date())} &middot; {order.number} &middot; page 1 of 1
          </div>
        </div>
      </div>
    </div>
  );
}
