import type { CSSProperties } from "react";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";

/** The custom properties `location-page.css` reads for each bar's motion. */
type BarStyle = CSSProperties & { "--i": number; "--lo": number; "--t": string };

/**
 * Bar heights, as a percentage of the band, left to right: two swells, the
 * shape of the sound-wave wall in the Van Nuys dining room.
 */
const BARS = [
  18, 26, 40, 62, 84, 70, 96, 78, 58, 44, 30, 22, 30, 48, 66, 88, 100, 82, 64, 46, 34, 24, 16,
];

/**
 * The Van Nuys dining-room wall, drawn: black sound-wave bars edged in red
 * and yellow, the red and yellow monsters on top, and the name's
 * pronunciation under it, as painted in the store.
 *
 * It plays in CSS alone (`location-page.css`), so it costs no script: the bars
 * rise left to right when the band scrolls into view (`cne-rv`), then keep
 * bouncing like a level meter, each at its own pace, while the monsters bob.
 * With reduced motion, or before the page's script runs, it is the still wall.
 */
export function SoundWave() {
  const red = MONSTER_COLORS.red;
  const yel = MONSTER_COLORS.yellow;
  return (
    <section className="cne-lp-wave cne-rv" aria-label="How to say Chris N Eddy's">
      <div className="cne-lp-wave-bars" aria-hidden="true">
        {BARS.map((h, i) => {
          const style: BarStyle = {
            height: `${h}%`,
            "--i": i,
            // Taller bars dip further, so the two swells keep their shape.
            "--lo": Math.round((0.35 + (1 - h / 100) * 0.4) * 100) / 100,
            // Mixed periods, so the bars never fall into step.
            "--t": `${0.46 + ((i * 7) % 5) * 0.09}s`,
          };
          return <span key={i} style={style} />;
        })}
        <Monster
          species="classic"
          bodyColor={red.body}
          irisColor={red.iris}
          size={96}
          className="cne-lp-wave-mon is-red"
        />
        <Monster
          species="classic"
          bodyColor={yel.body}
          irisColor={yel.iris}
          size={84}
          className="cne-lp-wave-mon is-yel"
        />
      </div>
      <p className="cne-lp-wave-say">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
          <path className="cne-lp-wave-arc" d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path className="cne-lp-wave-arc is-far" d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
        <span lang="en">/ˈkris-ən-ˈe-dēz/</span>
      </p>
    </section>
  );
}
