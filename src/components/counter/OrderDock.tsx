"use client";

import { usePathname } from "next/navigation";
import { orderUrl } from "@/lib/otter";
import { statusLabel, statusDetail, type StoreStatus } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The sticky bottom dock from the prototype: what Hollywood's clock is doing,
 * and one button to order. Phone only — desktop keeps ORDER in the header.
 *
 * It stands down on /shop. The product page has its own sticky bar carrying the
 * price and ADD TO BAG, and two bars fighting over the bottom 60px of a phone
 * means neither gets pressed. Food is still one tap away in the header, which
 * is where it stays on every page — the dock is the extra, not the entry.
 */
export function OrderDock() {
  const pathname = usePathname() ?? "/";
  const status = useStoreStatus("hollywood");
  const headline = dockHeadline(status);

  if (pathname.startsWith("/shop")) return null;

  return (
    <div className="cne-dock">
      <div className="cne-dock-msg">
        <div className="t">{headline}</div>
        <div className="s">{status ? statusDetail(status) : " "}</div>
      </div>
      <a className="cne-dockbtn" data-surface="dock" href={orderUrl("dock")} target="_blank" rel="noopener noreferrer">
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
