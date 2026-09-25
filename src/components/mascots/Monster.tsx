import type { CSSProperties } from "react";
import { monsterDrawing } from "./monsterColors";

/** `classic-sleep` is the classic body with its eye shut: a store or product
 * that is not ready yet (see `MascotDefs`). */
export type MonsterSpecies = "classic" | "classic-sleep";

/** The shared symbol for a body colour: the artist drew the red monster
 * separately, so red gets its own drawing. */
export function monsterHref(body: string): string {
  return monsterDrawing(body) === "red" ? "#cne-classic-red" : "#cne-classic";
}

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
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={classes}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href={species === "classic" ? monsterHref(bodyColor) : "#cne-classic-sleep"} />
    </svg>
  );
}
