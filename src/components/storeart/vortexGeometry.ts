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

/**
 * Distance, in viewBox units, from the vanishing point to the viewBox's
 * farthest corner. `preserveAspectRatio="xMidYMid slice"` only ever crops the
 * viewBox, so a square of this half-side centred on the vanishing point
 * covers every visible pixel at any rotation — which is what lets `Vortex`
 * spin the checker as one composited layer instead of repainting it.
 */
export function coverRadius({ W, H, vx, vy }: VortexGeometryParams): number {
  return Math.ceil(
    Math.max(
      Math.hypot(vx, vy),
      Math.hypot(W - vx, vy),
      Math.hypot(vx, H - vy),
      Math.hypot(W - vx, H - vy),
    ),
  );
}

/** Piecewise-linear lookup over `[t, value]` stops sorted by `t`. */
function lerpStops(stops: readonly (readonly [number, number])[], t: number): number {
  let prev: readonly [number, number] | undefined;
  for (const stop of stops) {
    if (prev && t <= stop[0]) {
      return prev[1] + ((stop[1] - prev[1]) * (t - prev[0])) / (stop[0] - prev[0]);
    }
    prev = stop;
  }
  return prev ? prev[1] : 0;
}

/** How far out along its orbit a monster is over one suck-in loop (1 = the
 * full ellipse, 0 = gone down the hole), and how visible it is. */
const SUCK_K = [
  [0, 1],
  [0.5, 0.62],
  [0.8, 0.28],
  [1, 0],
] as const;
const SUCK_OPACITY = [
  [0, 0],
  [0.06, 1],
  [0.92, 1],
  [1, 0],
] as const;
/** Degrees a monster travels round the spiral in one loop. */
const SUCK_SWEEP = 420;
/** Orbit scale a monster rests at when motion is reduced. */
export const REST_K = 0.55;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** One monster's transform at angle `a` (deg) and orbit scale `k`, in the
 * vanishing point's own viewBox-unit space. */
export function suckTransform(a: number, k: number, rx: number, ry: number): string {
  const rad = (a * Math.PI) / 180;
  return `translate(${r1(Math.cos(rad) * rx * k)}px,${r1(Math.sin(rad) * ry * k)}px) rotate(${r1(a * 1.5)}deg) scale(${Math.round((k * 0.9 + 0.1) * 1000) / 1000})`;
}

/**
 * The body of a `@keyframes` rule that sends a monster spiralling into the
 * hole, sampled into plain `transform` + `opacity` steps so the browser can
 * run it on the compositor. (The original drove two `@property` custom
 * properties, which re-ran style and repainted the whole SVG every frame.)
 * Steps are linear between samples; 40 is visually indistinguishable from
 * the continuous curve at 3.2s a loop.
 */
export function suckKeyframes(a0: number, rx: number, ry: number, steps = 40): string {
  const ts = new Set<number>();
  for (let i = 0; i <= steps; i++) ts.add(i / steps);
  for (const [t] of [...SUCK_K, ...SUCK_OPACITY]) ts.add(t);
  return [...ts]
    .sort((a, b) => a - b)
    .map((t) => {
      const k = lerpStops(SUCK_K, t);
      const o = r1(lerpStops(SUCK_OPACITY, t) * 100) / 100;
      return `${r1(t * 100)}%{transform:${suckTransform(a0 + SUCK_SWEEP * t, k, rx, ry)};opacity:${o}}`;
    })
    .join("");
}
