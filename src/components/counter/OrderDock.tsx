"use client";

import { usePathname } from "next/navigation";
import { orderUrl, withUtm } from "@/lib/otter";
import { openingLabel, statusLabel } from "@/lib/hours";
import { useViewedLocation } from "@/lib/useViewedLocation";
import { DirectionsLink } from "@/components/locations/DirectionsLink";
import { useStoreStatus } from "@/lib/useStoreStatus";
import { BiteTeeth } from "@/components/storeart/BiteTeeth";

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
 *
 * On a store's own page it is that store's dock (issue #153): its name, its
 * clock, its ORDER — or, before it opens, when it opens and DIRECTIONS.
 */
export function OrderDock() {
  const pathname = usePathname() ?? "/";
  const { loc, onLocationPage } = useViewedLocation();
  const status = useStoreStatus(loc.id);

  if (pathname.startsWith("/shop")) return null;

  const message = !status ? " " : loc.isOpen ? statusLabel(status) : openingLabel(loc);

  return (
    <div className="cne-dock" data-location={onLocationPage ? loc.id : undefined}>
      <div className="cne-dock-msg">
        <div className="t">{loc.name}</div>
        <div className="s">{message}</div>
      </div>
      {loc.isOpen ? (
        <a
          className="cne-dockbtn"
          data-surface="dock"
          href={onLocationPage && loc.orderUrl ? withUtm(loc.orderUrl, "dock") : orderUrl("dock")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <BiteTeeth position="top" />
          ORDER →
          <BiteTeeth position="bottom" />
        </a>
      ) : (
        <span data-surface="dock">
          <DirectionsLink loc={loc} className="cne-dockbtn">
            <BiteTeeth position="top" />
            DIRECTIONS →
            <BiteTeeth position="bottom" />
          </DirectionsLink>
        </span>
      )}
    </div>
  );
}
