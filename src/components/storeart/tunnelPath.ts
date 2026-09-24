import { vortexCells } from "./vortexGeometry";

/** The tunnel's geometry: the animated `Vortex` band's, squared and stilled. */
export const TUNNEL = {
  W: 600,
  H: 600,
  cx: 300,
  cy: 300,
  vx: 318,
  vy: 282,
  R: 520,
  rings: 16,
  cells: 24,
  twist: 11,
  pow: 1.6,
};

/**
 * The checkerboard tunnel from the Hollywood mural as one SVG path `d`: a
 * closed subpath per ink cell, whole-number points.
 */
export function tunnelPath(): string {
  return vortexCells(TUNNEL)
    .map((pts) => `M${pts.replace(/ /g, "L")}Z`)
    .join("");
}
