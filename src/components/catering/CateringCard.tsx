import Link from "next/link";
import { CATERING_HREF } from "@/data/catering";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import "@/styles/catering-card.css";

/**
 * The small "we cater" card that sits on the order page and under the menu.
 * Its button opens the contact form, where catering is arranged with the
 * owners (see src/data/catering.ts). No hours, minimums or fees on the site
 * (owner, 2026-09-26). The footer's "Catering" link is what points at
 * /catering/ itself.
 *
 * The button is cream, never the ORDER yellow, so ORDER stays the loudest
 * thing on the pages this sits on. A monster peeks over the top corner.
 * `surface` names the spot in Analytics; `data-catering` makes the click a
 * `catering_click`.
 */
export function CateringCard({
  eyebrow,
  title,
  text,
  surface,
  monster,
  href,
}: {
  eyebrow: string;
  title: string;
  text: string;
  surface: string;
  monster: keyof typeof MONSTER_COLORS;
  /**
   * Where the button goes — `CATERING_HREF` (the contact form) unless the
   * caller has checked `cateringOrderingOn` and passes `/catering/order/`
   * instead. Defaults to the contact form so a caller that hasn't checked
   * keeps today's behaviour.
   */
  href?: string;
}) {
  const colors = MONSTER_COLORS[monster];
  const target = href ?? CATERING_HREF;
  const ordering = target !== CATERING_HREF;
  return (
    <aside className="cne-catcard" aria-label="Catering" data-surface={surface}>
      <Monster
        species="classic"
        bodyColor={colors.body}
        irisColor={colors.iris}
        size={52}
        className="cne-catcard-peek"
      />
      <div className="cne-catcard-copy">
        <p className="cne-catcard-k">{eyebrow}</p>
        <h2 className="cne-catcard-h">{title}</h2>
        <p className="cne-catcard-p">{text}</p>
      </div>
      <div className="cne-catcard-act">
        <Link
          prefetch={false}
          className="cne-big"
          href={target}
          {...(ordering ? { "data-catering-order": "start" } : { "data-catering": "" })}
        >
          {ordering ? "START A CATERING ORDER" : "ASK ABOUT CATERING"} &rarr;
        </Link>
      </div>
    </aside>
  );
}
