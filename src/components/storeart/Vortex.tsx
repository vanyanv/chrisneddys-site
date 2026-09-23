"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  REST_K,
  coverRadius,
  suckKeyframes,
  suckTransform,
  vortexCells,
  type VortexGeometryParams,
} from "./vortexGeometry";
import "@/styles/vortex.css";

/** `band` is the decorative strip above the footer. `screen` is a
 * full-viewport overlay (see the SLIDE secret code in `SlideCode.tsx`) —
 * faster spin, four monsters, sized to fill whatever fixed/absolute box its
 * caller puts it in via `.cne-vortex-screen`. */
export type VortexVariant = "band" | "screen";

export interface VortexMonsterSpec {
  /** Starting angle on the spiral, in degrees. */
  a0: number;
  /** On-screen size (px, in the 0 0 200 200 monster viewBox's own scale). */
  size: number;
  /** One full suck-in loop, in seconds. */
  dur: number;
  /** Negative delay staggers monsters along the same loop. */
  delay: number;
  body: string;
  iris: string;
}

/** Geometry plus the vortex's own SVG extras (hole size, monster orbit). */
export interface VortexParams extends VortexGeometryParams {
  /** Radius of the dark "hole" gradient at the vanishing point. Defaults to
   * `R * 0.3`, matching the source demo. */
  hole?: number;
  /** Monster orbit half-extents. Default to half the viewBox. */
  rx?: number;
  ry?: number;
}

interface VortexVariantConfig {
  params: VortexParams;
  monsters: VortexMonsterSpec[];
  /** One full ring rotation, in seconds. Defaults to 60 (the band's slow
   * drift) when omitted. */
  spinSeconds?: number;
}

/** Owner-approved art direction per variant — see the demo's `vortex.mjs` /
 * `ideas.mjs` this was ported from. */
const VARIANTS: Record<VortexVariant, VortexVariantConfig> = {
  band: {
    params: {
      W: 1600,
      H: 420,
      cx: 800,
      cy: 210,
      vx: 780,
      vy: 225,
      R: 1150,
      rings: 24,
      cells: 30,
      twist: 9,
      pow: 1.85,
      hole: 140,
    },
    // Owner call (issue #106): the band is now a thin strip, too short for
    // the suck-in monsters to read at any size — dropped rather than shrunk.
    monsters: [],
  },
  // Full-viewport intro/SLIDE-code geometry — ported from `ideas.mjs`'s
  // `INTRO`/`INTRO_MON` (the welcome-vortex demo), which is also the "those
  // four monsters" the SLIDE code brief points back to.
  screen: {
    params: {
      W: 1600,
      H: 900,
      cx: 820,
      cy: 440,
      vx: 800,
      vy: 460,
      R: 1250,
      rings: 26,
      cells: 30,
      twist: 9,
      pow: 1.9,
      hole: 330,
      rx: 820,
      ry: 470,
    },
    monsters: [
      { a0: 200, size: 190, dur: 3.2, delay: -0.4, body: "#2e5fd9", iris: "#e63027" },
      { a0: -20, size: 170, dur: 3.2, delay: -1.2, body: "#e63027", iris: "#2e5fd9" },
      { a0: 110, size: 160, dur: 3.2, delay: -2, body: "#f5d20e", iris: "#e63027" },
      { a0: 290, size: 150, dur: 3.2, delay: -2.7, body: "#c6ff2b", iris: "#e63027" },
    ],
    spinSeconds: 10,
  },
};

/** `useId` includes colons, invalid in a CSS identifier or custom-property
 * name — strip everything but letters/digits so gradient ids, `@property`
 * names and keyframe names are unique per instance and CSS-legal. */
function useCssId(prefix: string) {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
}

type FillStyle = CSSProperties & { fill?: string };
type StopStyle = CSSProperties & { stopColor?: string; stopOpacity?: number };
type MonsterStyle = CSSProperties & {
  "--m-body"?: string;
  "--m-iris"?: string;
};

/**
 * Reusable checkerboard black-hole vortex: rings twist toward an off-center
 * vanishing point while monsters spiral into the dark "hole" one at a time.
 *
 * Renders a plain cream placeholder (same size, no polygons) until the band
 * comes within ~400px of the viewport, so the home page never ships the
 * (potentially hundreds of) polygons in its initial HTML. Once revealed, a
 * second, tighter observer pauses the animation whenever it's actually off
 * screen. Under `prefers-reduced-motion: reduce` the CSS simply never
 * applies the spin/suck keyframes, leaving the checker still and the
 * monsters at their resting orbit position.
 */
export function Vortex({
  variant,
  className,
  label,
}: {
  variant: VortexVariant;
  className?: string;
  label?: string;
}) {
  const uid = useCssId("cnevx");
  const rootRef = useRef<HTMLDivElement>(null);
  // The screen variant only ever mounts on demand (intro, SLIDE code) and is
  // on screen the moment it does, so it skips the lazy reveal below.
  const [ready, setReady] = useState(variant === "screen");

  const { params, monsters, spinSeconds = 60 } = VARIANTS[variant];
  const { W, H, vx, vy, hole = params.R * 0.3, rx = W * 0.5, ry = H * 0.5 } = params;

  // Generate the polygons only once the band is close to the viewport.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || ready) return;
    if (!("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
    // Runs once: `ready` only ever flips false -> true, from inside here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once rendered, pause the (many-element) animation whenever the band is
  // actually off screen — independent of the 400px pre-generation above.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || !ready) return;
    if (!("IntersectionObserver" in window)) {
      node.style.setProperty(`--${uid}-play`, "running");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      const on = entries.some((e) => e.isIntersecting);
      node.style.setProperty(`--${uid}-play`, on ? "running" : "paused");
    });
    io.observe(node);
    return () => io.disconnect();
  }, [ready, uid]);

  // `--s`: CSS px per viewBox unit under `xMidYMid slice` — the same scale
  // an SVG viewBox would apply for free, handed to the composited layers
  // (spin, monster orbit) that can't use a viewBox. Set before first paint
  // (ResizeObserver callbacks run ahead of it).
  useEffect(() => {
    const node = rootRef.current;
    if (!node || !ready) return;
    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width && height) node.style.setProperty("--s", String(Math.max(width / W, height / H)));
    };
    update();
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ready, W, H]);

  const polys = useMemo(() => (ready ? vortexCells(params) : null), [ready, params]);
  const r = coverRadius(params);

  const classes = ["cne-vortex", `cne-vortex-${variant}`, className].filter(Boolean).join(" ");
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  const creamFill: FillStyle = { fill: "var(--color-cne-cream)" };
  const inkFill: FillStyle = { fill: "var(--color-cne-ink)" };
  const inkStop: StopStyle = { stopColor: "var(--color-cne-ink)" };
  const inkStopFade: StopStyle = { stopColor: "var(--color-cne-ink)", stopOpacity: 0.6 };
  const inkStopClear: StopStyle = { stopColor: "var(--color-cne-ink)", stopOpacity: 0 };

  // Screen position of the vanishing point: the viewBox is centred in the
  // box, so it sits at 50% plus its offset from the viewBox centre, scaled.
  const at = `left:calc(50% + ${vx - W / 2}px * var(--s,1));top:calc(50% + ${vy - H / 2}px * var(--s,1))`;
  const play = `animation-play-state:var(--${uid}-play,paused)`;

  return (
    <div ref={rootRef} className={classes} {...a11y}>
      {!polys ? (
        <div className="cne-vortex-placeholder" />
      ) : (
        <>
          {/* The checker and its dark hole: one square SVG centred on the
              vanishing point and big enough to cover the box at any angle,
              spun by a CSS transform on its wrapper — rasterised once and
              rotated on the compositor, instead of repainting every polygon
              every frame. The hole is a radial gradient centred on that same
              point, so it looks identical at every angle and can ride along
              in the same layer rather than cost one of its own. */}
          <div className={`${uid}-spin`}>
            <svg viewBox={`${vx - r} ${vy - r} ${2 * r} ${2 * r}`} focusable="false">
              <defs>
                <radialGradient
                  id={`${uid}-hole`}
                  cx={vx}
                  cy={vy}
                  r={hole}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0" style={inkStop} />
                  <stop offset="0.35" style={inkStop} />
                  <stop offset="0.7" style={inkStopFade} />
                  <stop offset="1" style={inkStopClear} />
                </radialGradient>
              </defs>
              <rect x={vx - r} y={vy - r} width={2 * r} height={2 * r} style={creamFill} />
              <g style={inkFill}>
                {polys.map((p, i) => (
                  <polygon key={i} points={p} />
                ))}
              </g>
              <circle cx={vx} cy={vy} r={hole} fill={`url(#${uid}-hole)`} />
            </svg>
          </div>
          {monsters.length > 0 && (
            <div className={`${uid}-orbit`}>
              {monsters.map((m, i) => {
                const style: MonsterStyle = {
                  "--m-body": m.body,
                  "--m-iris": m.iris,
                  width: m.size,
                  height: m.size,
                  left: -m.size / 2,
                  top: -m.size / 2,
                };
                return (
                  <div key={i} className={`${uid}-m ${uid}-m${i}`} style={style}>
                    <svg viewBox="0 0 200 200" focusable="false">
                      <use href="#cne-classic" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
          {/* Per-instance styles: keyframe names are keyed by \`uid\` so two
              Vortex instances (e.g. the band + the SLIDE code on the same
              page) never collide. Every animation here is transform/opacity
              only, so it runs on the compositor. */}
          <style>{`
.${uid}-spin{position:absolute;${at};width:calc(${2 * r}px * var(--s,1));height:calc(${2 * r}px * var(--s,1));transform:translate(-50%,-50%)}
.${uid}-orbit{position:absolute;${at};width:0;height:0;transform:scale(var(--s,1))}
.${uid}-m{position:absolute}
${monsters.map((m, i) => `.${uid}-m${i}{transform:${suckTransform(m.a0, REST_K, rx, ry)}}`).join("\n")}
@media (prefers-reduced-motion: no-preference){
.${uid}-spin{animation:${uid}-spin ${spinSeconds}s linear infinite;${play}}
@keyframes ${uid}-spin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
${monsters.map((m, i) => `.${uid}-m${i}{opacity:0;animation:${uid}-suck${i} ${m.dur}s linear ${m.delay}s infinite;${play}}\n@keyframes ${uid}-suck${i}{${suckKeyframes(m.a0, rx, ry)}}`).join("\n")}
}
`}</style>
        </>
      )}
    </div>
  );
}
