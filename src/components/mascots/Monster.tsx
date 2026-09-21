import type { CSSProperties } from "react";

export type MonsterSpecies = "classic" | "blacklight" | "bubble";

const VIEW_BOX: Record<MonsterSpecies, string> = {
  classic: "0 0 200 200",
  blacklight: "0 0 200 200",
  bubble: "0 0 100 100",
};

/** The custom properties `MascotDefs`' symbols read, plus the glow's `--glow`. */
type MonsterStyle = CSSProperties & {
  "--m-body"?: string;
  "--m-iris"?: string;
  "--m-pupil"?: string;
  "--glow"?: string;
};

/**
 * One monster mascot, drawn by referencing the shared symbol defs in
 * `MascotDefs` (mounted once, sitewide, in the root layout) rather than
 * inlining its own markup — every instance of the same species is otherwise
 * pixel-identical, so there is nothing to gain by duplicating it 19 times.
 *
 * `glowColor` is opt-in and, per the design's "glow only on an already-dark
 * surface" rule, is only ever passed for the footer's blacklight monster —
 * everywhere else the monster sits on the site's cream/red daylight palette,
 * where a neon glow would look like a bug rather than a wall mural detail.
 */
export function Monster({
  species,
  bodyColor,
  irisColor,
  pupilColor,
  glowColor,
  size = 48,
  className,
}: {
  species: MonsterSpecies;
  bodyColor: string;
  irisColor: string;
  pupilColor?: string;
  glowColor?: string;
  size?: number;
  className?: string;
}) {
  const style: MonsterStyle = {
    "--m-body": bodyColor,
    "--m-iris": irisColor,
  };
  if (pupilColor) style["--m-pupil"] = pupilColor;
  if (glowColor) style["--glow"] = glowColor;

  const classes = ["cne-mascot", glowColor ? "cne-mascot-glow" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox={VIEW_BOX[species]}
      width={size}
      height={size}
      className={classes}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#cne-${species}`} />
    </svg>
  );
}
