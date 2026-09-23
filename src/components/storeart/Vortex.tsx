"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { vortexCells, type VortexGeometryParams } from "./vortexGeometry";
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
  "--a0"?: string;
  "--d"?: string;
  "--delay"?: string;
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
  const [ready, setReady] = useState(false);

  const { params, monsters, spinSeconds = 60 } = VARIANTS[variant];
  const { W, H, vx, vy, hole = params.R * 0.3, rx = W * 0.5, ry = H * 0.5 } = params;

  // Generate the polygons only once the band is close to the viewport.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
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

  const polys = useMemo(() => (ready ? vortexCells(params) : null), [ready, params]);

  const classes = ["cne-vortex", `cne-vortex-${variant}`, className].filter(Boolean).join(" ");
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  const creamFill: FillStyle = { fill: "var(--color-cne-cream)" };
  const inkFill: FillStyle = { fill: "var(--color-cne-ink)" };
  const inkStop: StopStyle = { stopColor: "var(--color-cne-ink)" };
  const inkStopFade: StopStyle = { stopColor: "var(--color-cne-ink)", stopOpacity: 0.6 };
  const inkStopClear: StopStyle = { stopColor: "var(--color-cne-ink)", stopOpacity: 0 };

  return (
    <div ref={rootRef} className={classes} {...a11y}>
      {!polys ? (
        <div className="cne-vortex-placeholder" />
      ) : (
        <>
          <svg
            className={`${uid}-svg`}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid slice"
            focusable="false"
          >
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
            <rect width={W} height={H} style={creamFill} />
            <g className={`${uid}-spin`} style={{ transformOrigin: `${vx}px ${vy}px` }}>
              <g style={inkFill}>
                {polys.map((p, i) => (
                  <polygon key={i} points={p} />
                ))}
              </g>
            </g>
            <rect width={W} height={H} fill={`url(#${uid}-hole)`} />
            <g transform={`translate(${vx} ${vy})`}>
              {monsters.map((m, i) => {
                const style: MonsterStyle = {
                  "--a0": `${m.a0}deg`,
                  "--d": `${m.dur}s`,
                  "--delay": `${m.delay}s`,
                  "--m-body": m.body,
                  "--m-iris": m.iris,
                };
                return (
                  <g key={i} className={`${uid}-m`} style={style}>
                    <use
                      href="#cne-classic"
                      x={-m.size / 2}
                      y={-m.size / 2}
                      width={m.size}
                      height={m.size}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
          {/* Per-instance styles: `@property` and keyframe names are keyed by
              `uid` so two Vortex instances (e.g. a future band + intro on the
              same page) never collide. */}
          <style>{`
.${uid}-svg{display:block;width:100%;height:100%}
@property --${uid}-a{syntax:"<angle>";inherits:false;initial-value:0deg}
@property --${uid}-k{syntax:"<number>";inherits:false;initial-value:0.55}
.${uid}-m{--${uid}-a:var(--a0);transform:translate(calc(cos(var(--${uid}-a)) * ${rx}px * var(--${uid}-k)),calc(sin(var(--${uid}-a)) * ${ry}px * var(--${uid}-k))) rotate(calc(var(--${uid}-a) * 1.5)) scale(calc(var(--${uid}-k) * 0.9 + 0.1))}
@media (prefers-reduced-motion: no-preference){
.${uid}-spin{animation:${uid}-spin ${spinSeconds}s linear infinite;animation-play-state:var(--${uid}-play,paused)}
@keyframes ${uid}-spin{to{transform:rotate(360deg)}}
.${uid}-m{animation:${uid}-suck var(--d) linear var(--delay) infinite;animation-play-state:var(--${uid}-play,paused)}
@keyframes ${uid}-suck{0%{--${uid}-a:var(--a0);--${uid}-k:1;opacity:0}6%{opacity:1}50%{--${uid}-k:.62}80%{--${uid}-k:.28}92%{opacity:1}100%{--${uid}-a:calc(var(--a0) + 420deg);--${uid}-k:0;opacity:0}}
}
`}</style>
        </>
      )}
    </div>
  );
}
