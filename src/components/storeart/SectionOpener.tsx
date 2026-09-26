import type { CSSProperties } from "react";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";

/**
 * Idea 15 + idea 4: the "four ways to open a section" op-art pieces, drawn
 * once as symbols in `MascotDefs` (`cne-bullseye`, `cne-diamond`,
 * `cne-stripe`, `cne-checker`, `cne-square`) and referenced here with
 * `<use>` so the shapes ship once no matter how many sections use them.
 * Server components — no client JS, just markup — safe to import from a
 * client file too (`MenuBrowser`) since nothing here needs the DOM.
 */

const GLYPHS = ["bullseye", "stripe", "diamond", "checker", "dot", "square", "bullseye"] as const;
const GLYPH_HREF: Partial<Record<(typeof GLYPHS)[number], string>> = {
  bullseye: "#cne-bullseye",
  stripe: "#cne-stripe",
  diamond: "#cne-diamond",
  checker: "#cne-checker",
  square: "#cne-square",
};

/** The row of op-art glyphs a `cne-op-glyph` section opener sits above its
 * eyebrow: bullseye, stripe circle, diamond, checker square, a hot-pink dot,
 * nested square, bullseye. ~18px per glyph; `.cne-op-glyphrow` in
 * counter.css scales the whole row down for a phone. */
export function GlyphRow() {
  const size = 18;
  const gap = 6;
  const w = GLYPHS.length * size + (GLYPHS.length - 1) * gap;
  return (
    <svg
      className="cne-op-glyphrow"
      viewBox={`0 0 ${w} ${size}`}
      width={w}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS.map((kind, i) => {
        const x = i * (size + gap);
        if (kind === "dot") {
          return <circle key={i} cx={x + size / 2} cy={size / 2} r={size / 2 - 1} fill="#ff4fa3" />;
        }
        return <use key={i} href={GLYPH_HREF[kind]} x={x} y={0} width={size} height={size} />;
      })}
    </svg>
  );
}

export type StampKind = "bullseye" | "stripe" | "checker" | "square" | "pink";

const STAMP_HREF: Record<StampKind, string> = {
  bullseye: "#cne-bullseye",
  stripe: "#cne-stripe",
  checker: "#cne-checker",
  square: "#cne-square",
  // The pink stamp is the bullseye ring redrawn in hot pink, not a sixth
  // symbol — same trick `cne-classic-sleep` plays on `cne-classic`.
  pink: "#cne-bullseye",
};

/** One op-art stamp: the mark that ends a `cne-op-stamp` heading and each
 * menu category's `.cne-cat-h`. `size` is the default rendered size; the
 * caller's `className` can override it responsively. */
export function OpStamp({
  kind,
  size = 44,
  className,
}: {
  kind: StampKind;
  size?: number;
  className?: string;
}) {
  const style: CSSProperties | undefined =
    kind === "pink" ? ({ "--op-b": "#ff4fa3" } as CSSProperties) : undefined;
  return (
    <svg
      className={className ? `cne-op-stamp-svg ${className}` : "cne-op-stamp-svg"}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href={STAMP_HREF[kind]} />
    </svg>
  );
}

/**
 * Idea 4's "wall pillar": the menu rail's empty foot, desktop only
 * (`.cne-op-pillar` is hidden below 901px in counter.css). A checkerboard
 * slab in ink and cream, the three most-used monster colours piled at its
 * foot, and one stripe stamp — a small echo of the mural's own pillar
 * without shipping its full illustration.
 */
export function MenuPillar() {
  return (
    <div className="cne-op-pillar" aria-hidden="true">
      <OpStamp kind="stripe" size={40} className="cne-op-pillar-stamp" />
      <div className="cne-op-pillar-mon">
        <Monster
          species="classic"
          bodyColor={MONSTER_COLORS.blue.body}
          irisColor={MONSTER_COLORS.blue.iris}
          size={44}
        />
        <Monster
          species="classic"
          bodyColor={MONSTER_COLORS.yellow.body}
          irisColor={MONSTER_COLORS.yellow.iris}
          size={36}
        />
        <Monster
          species="classic"
          bodyColor={MONSTER_COLORS.red.body}
          irisColor={MONSTER_COLORS.red.iris}
          size={30}
        />
      </div>
    </div>
  );
}
