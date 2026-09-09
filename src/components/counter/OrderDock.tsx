"use client";

import { storeUrl } from "@/lib/otter";
import { statusLabel, statusDetail, type StoreStatus } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The sticky bottom dock from the prototype: what Hollywood's clock is doing,
 * and one button to order. Phone only — desktop keeps ORDER in the header.
 */
export function OrderDock() {
  const status = useStoreStatus("hollywood");
  const headline = dockHeadline(status);

  return (
    <div className="cne-dock">
      <div className="cne-dock-msg">
        <div className="t">{headline}</div>
        <div className="s">{status ? statusDetail(status) : " "}</div>
      </div>
      <a className="cne-dockbtn" href={storeUrl} target="_blank" rel="noopener noreferrer">
        ORDER →
      </a>
    </div>
  );
}

/** Ruled out `unknown` explicitly — only `open` and `last-call` carry a countdown. */
function dockHeadline(status: StoreStatus | null): string {
  if (!status) return "Hollywood";
  switch (status.state) {
    case "closed":
      return "Hollywood · closed";
    case "last-call":
      return `Hollywood · ${statusLabel(status)}`;
    case "open":
      return status.minutesLeft <= 180
        ? `Hollywood · ${statusLabel(status)}`
        : "Hollywood · open now";
    default:
      return "Hollywood";
  }
}
