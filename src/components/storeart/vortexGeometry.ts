/**
 * Checkerboard black-hole vortex geometry — ported from the owner-approved
 * demo (`vortex.mjs`'s `vortexCells`). Rings shrink toward an off-center
 * vanishing point and twist as they go, and every other cell of the
 * resulting checker ring is skipped to leave the alternating pattern.
 *
 * Pure and side-effect free so it can run once, on the client, only when the
 * `Vortex` component actually needs the polygons (see its intersection
 * observer) rather than on every render or on the server.
 */

/** Geometry inputs shared with the SVG's viewBox (`W`/`H`) and hole/monster
 * placement (`hole`, `rx`, `ry`) in `Vortex.tsx` — kept on one type so a
 * variant's params object only has to be defined once. */
export interface VortexGeometryParams {
  /** ViewBox width/height — unused here, kept for callers that share this
   * object with the SVG markup and the monsters' orbit radius. */
  W: number;
  H: number;
  /** Ring center. */
  cx: number;
  cy: number;
  /** Vanishing point the rings twist and shrink toward. */
  vx: number;
  vy: number;
  /** Outermost ring radius. */
  R: number;
  rings?: number;
  cells?: number;
  /** Degrees of extra rotation per ring, closer rings turning further. */
  twist?: number;
  /** Easing power on how fast rings shrink/shift toward the vanishing point. */
  pow?: number;
}

/** Whole-number coordinates keep the polygon markup small. */
const round = (n: number) => Math.round(n);

/**
 * Returns one SVG `points` string per checker cell (ready for `<polygon
 * points="...">`), in ink-fill draw order.
 */
export function vortexCells(params: VortexGeometryParams): string[] {
  const { cx, cy, vx, vy, R, rings = 22, cells = 28, twist = 9, pow = 1.7 } = params;

  const ring = (i: number) => {
    const t = i / rings;
    return {
      r: Math.max(0, R * Math.pow(1 - t, pow)),
      x: cx + (vx - cx) * Math.pow(t, 0.7),
      y: cy + (vy - cy) * Math.pow(t, 0.7),
      a: (i * twist * Math.PI) / 180,
    };
  };

  const out: string[] = [];
  for (let i = 0; i < rings; i++) {
    const o = ring(i);
    const n = ring(i + 1);
    if (o.r < 2) break;
    for (let j = 0; j < cells; j++) {
      // Checkerboard parity: skip every other cell, offset by ring index.
      if ((i + j) % 2) continue;
      const pts: string[] = [];
      const S = 5;
      for (let k = 0; k <= S; k++) {
        const th = o.a + ((j + k / S) * 2 * Math.PI) / cells;
        pts.push(`${round(o.x + o.r * Math.cos(th))},${round(o.y + o.r * Math.sin(th))}`);
      }
      for (let k = S; k >= 0; k--) {
        const th = n.a + ((j + k / S) * 2 * Math.PI) / cells;
        pts.push(`${round(n.x + n.r * Math.cos(th))},${round(n.y + n.r * Math.sin(th))}`);
      }
      out.push(pts.join(" "));
    }
  }
  return out;
}
