import { notFound } from "next/navigation";
import { itemById } from "@/data/menu";
import { getOrderById } from "@/lib/catering/orders";
import { groupForCrew, wayLabel, type CartLine, type CrewBuild } from "@/lib/catering";
import { formatDate } from "../../format";
import { PrintButton } from "./PrintButton";
import "@/styles/admin-rack.css";
import "@/styles/admin-catering.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Same rule as the crew ticket's `buildLabel`: an item that doesn't take
 * toppings (Grilled Cheese, shakes, extra sauce) gets no way/"Custom" label. */
function buildLabel(itemId: string, build: CrewBuild): string {
  if (!itemById(itemId)?.takesToppings) return "";
  if (!build.wayId || build.wayId === "custom") return "Custom";
  return wayLabel(build.wayId);
}

type LabelCard = {
  key: string;
  title: string;
  itemLine: string;
  detail: string;
  halal: boolean;
};

/** Bag-and-tray labels (A7, Avery 5163 — 2 × 5 per letter sheet): one label
 * per named order (bag it, label it) and one per unnamed tray (the bulk
 * builds nobody's name is on). A build `groupForCrew` already merged under
 * one name (e.g. "Halal table") counts as a single named label here, not
 * one per unit. */
export default async function LabelsPage({ params }: { params: Promise<Params> }) {
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

  const namedLabels: LabelCard[] = order.items
    .filter((item) => item.forName)
    .map((item) => ({
      key: item.id,
      title: item.forName!,
      itemLine: item.qty > 1 ? `${item.qty} × ${item.itemName}` : item.itemName,
      detail: [
        item.wayLabel ?? (item.toppingLabels.length > 0 ? "Custom" : ""),
        ...item.toppingLabels,
        ...item.extraLabels,
      ]
        .filter(Boolean)
        .join(", "),
      halal: item.extraLabels.some((l) => /halal/i.test(l)),
    }));

  const trayLabels: LabelCard[] = groups.flatMap((group) =>
    group.builds
      .filter((build) => build.names.length === 0)
      .map((build, i) => ({
        key: `${group.itemId}-${i}`,
        title: buildLabel(group.itemId, build),
        itemLine: `${build.count} × ${group.itemName}`,
        detail: build.toppingLabels.concat(build.extraLabels).join(", "),
        halal: build.halal,
      })),
  );

  const labels = [...namedLabels, ...trayLabels];

  return (
    <div className="rack-slip-page">
      <div className="rack-slip-noprint">
        <PrintButton />
      </div>

      <div className="rack-slip-sheet">
        <div className="cat-labels-header">
          <div>
            <div className="rack-bow" style={{ fontSize: 20 }}>
              Chris N Eddy&rsquo;s
            </div>
            <div className="rack-eyebrow" style={{ marginTop: 4 }}>
              Bag and tray labels &middot; {order.number}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="rack-bow" style={{ fontSize: 22 }}>
              LABELS
            </div>
            <div className="rack-mono" style={{ fontSize: 10, color: "var(--rack-muted)" }}>
              Avery 5163 &middot; 2 × 5 per sheet
            </div>
          </div>
        </div>

        <div className="cat-labels-grid">
          {labels.map((label) => (
            <div key={label.key} className={`cat-label${label.halal ? " is-halal" : ""}`}>
              <div>
                <div className="cat-label-name">{label.title}</div>
                <div className="cat-label-item">{label.itemLine}</div>
                {label.detail && <div className="cat-label-detail">{label.detail}</div>}
              </div>
              <div className="cat-label-footer">
                <span>
                  {order.number} &middot; {formatDate(order.eventAt)}
                </span>
                {label.halal && <span className="cat-label-halal-badge">HALAL</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
