import { cateringPlatform } from "@/data/delivery";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import "@/styles/catering-card.css";

/**
 * The small "we cater" card that sits on the order page and under the menu.
 * Its button goes straight to ezCater, which holds everything a catering
 * customer needs to know (menu, hours, fees, changes): the owner asked for none
 * of that to be copied onto the site. The footer's "Catering" link is what
 * points at /catering/ itself.
 *
 * The button is cream, never the ORDER yellow, so ORDER stays the loudest
 * thing on the pages this sits on. A monster peeks over the top corner.
 * `surface` names the spot in Analytics; the store comes from the ezCater link
 * itself (`clickLocation`).
 */
export function CateringCard({
  eyebrow,
  title,
  text,
  surface,
  monster,
}: {
  eyebrow: string;
  title: string;
  text: string;
  surface: string;
  monster: keyof typeof MONSTER_COLORS;
}) {
  const colors = MONSTER_COLORS[monster];
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
        <a
          className="cne-big"
          href={cateringPlatform.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          ORDER CATERING &rarr;
        </a>
        <span className="cne-catcard-on">ON {cateringPlatform.name.toUpperCase()}</span>
      </div>
    </aside>
  );
}
