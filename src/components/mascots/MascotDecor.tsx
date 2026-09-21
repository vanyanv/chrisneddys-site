import type { CSSProperties } from "react";

export type MascotDecorKind = "bullseye" | "diamond" | "drip" | "numbers" | "court";

const VIEW_BOX: Record<MascotDecorKind, string> = {
  bullseye: "0 0 200 200",
  diamond: "0 0 200 200",
  drip: "0 0 40 60",
  numbers: "0 0 200 200",
  court: "0 0 200 200",
};

/** Which custom property `colorA`/`colorB` maps to for a given kind. */
const COLOR_A_VAR: Record<
  MascotDecorKind,
  "--op-a" | "--drip-color" | "--num-color" | "--court-color"
> = {
  bullseye: "--op-a",
  diamond: "--op-a",
  drip: "--drip-color",
  numbers: "--num-color",
  court: "--court-color",
};

type DecorStyle = CSSProperties & {
  "--op-a"?: string;
  "--op-b"?: string;
  "--drip-color"?: string;
  "--num-color"?: string;
  "--court-color"?: string;
};

/**
 * The non-monster wall elements from the same mural set — target rings,
 * diamonds, paint drips, the scoreboard numbers and the half-court sketch —
 * drawn by referencing `MascotDefs`' shared symbols the same way `Monster`
 * does. `colorB` only applies to the two-tone symbols (bullseye, diamond);
 * everything else takes a single color through `colorA`.
 */
export function MascotDecor({
  kind,
  colorA,
  colorB,
  size = 48,
  className,
  style: styleProp,
}: {
  kind: MascotDecorKind;
  colorA?: string;
  colorB?: string;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  const style: DecorStyle = { ...styleProp };
  if (colorA) style[COLOR_A_VAR[kind]] = colorA;
  if (colorB && (kind === "bullseye" || kind === "diamond")) style["--op-b"] = colorB;

  const classes = ["cne-mascot", className ?? ""].filter(Boolean).join(" ");

  return (
    <svg
      viewBox={VIEW_BOX[kind]}
      width={size}
      height={size}
      className={classes}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#cne-${kind}`} />
    </svg>
  );
}
