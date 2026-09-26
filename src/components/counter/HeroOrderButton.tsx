"use client";

import { OrderLink } from "@/components/order/OrderLink";
import { orderCtaSubline } from "@/lib/hours";
import { useStoreStatus } from "@/lib/useStoreStatus";

/**
 * The hero's primary CTA. Same button every time — it asks which store the
 * first time and then remembers (`OrderLink`, issue #178) — and the only
 * thing that ever changes is whether a second, smaller line names the
 * Hollywood store's opening time, which it only does while the store is
 * actually closed. Splitting it onto its own line (rather than running it
 * into "ORDER ONLINE · OPENS 10 AM →" as one phrase) is what keeps a narrow
 * button from wrapping mid-phrase — "10" and "AM" landing on separate lines.
 *
 * `useStoreStatus` is null until the client clock mounts (the site is a
 * static export, so the server never knows the time), which is why the
 * single-line button an open visitor sees pre-mount is also what they see
 * after — nothing flashes or resizes for them. A visitor arriving while the
 * store is closed sees the plain single line for a moment and then the
 * second line fills in.
 */
export function HeroOrderButton() {
  const status = useStoreStatus("hollywood");
  const subline = orderCtaSubline(status);

  return (
    <OrderLink surface="hero" className="cne-big is-primary">
      {subline ? (
        <span className="cne-cta-lines">
          <span>ORDER ONLINE →</span>
          <span className="cne-cta-sub">{subline}</span>
        </span>
      ) : (
        "ORDER ONLINE →"
      )}
    </OrderLink>
  );
}
