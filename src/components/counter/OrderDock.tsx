"use client";

import { usePathname } from "next/navigation";
import { orderUrl } from "@/lib/otter";
import { statusLabel } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The sticky bottom dock from the prototype: what Hollywood's clock is doing,
 * and one button to order. Phone only — desktop keeps ORDER in the header.
 *
 * The store's name rides in the small line and the clock in the big one, which
 * is the way round that matches what actually changes. It used to run a
 * countdown under three hours to close — "Hollywood · 2H 15M LEFT" — with the
 * closing time repeated underneath it. Now it says one fact once, in the same
 * words the header tag uses.
 *
 * It stands down on /shop. The product page has its own sticky bar carrying the
 * price and ADD TO BAG, and two bars fighting over the bottom 60px of a phone
 * means neither gets pressed. Food is still one tap away in the header, which
 * is where it stays on every page — the dock is the extra, not the entry.
 */
export function OrderDock() {
  const pathname = usePathname() ?? "/";
  const status = useStoreStatus("hollywood");

  if (pathname.startsWith("/shop")) return null;

  return (
    <div className="cne-dock">
      <div className="cne-dock-msg">
        <div className="t">Hollywood</div>
        <div className="s">{status ? statusLabel(status) : " "}</div>
      </div>
      <a className="cne-dockbtn" data-surface="dock" href={orderUrl("dock")} target="_blank" rel="noopener noreferrer">
        ORDER →
      </a>
    </div>
  );
}
