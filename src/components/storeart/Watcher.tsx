"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Idea 2. The hero's corner monster — same body/iris/size/class as before —
 * with an eye that tracks the pointer on fine-pointer devices. Everything
 * else about it (position, drop shadow) still comes from `.cne-badge-corner`
 * in `mascots.css`; this only adds the movable iris.
 *
 * Touch devices and reduced motion both leave the eye centered: there is no
 * pointer to track, and the idle "wander" the demo has for that case is
 * optional, so it's skipped rather than shipping a second animation path.
 */

const SIZE = 46;
const EYE_CX = 100;
const EYE_CY = 76;
const MAX_SHIFT = 11;

type WatcherStyle = CSSProperties & { "--m-body"?: string; "--m-iris"?: string };

export function Watcher({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const irisRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const iris = irisRef.current;
    if (!svg || !iris) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pointer: { x: number; y: number } | null = null;

    const apply = () => {
      raf = 0;
      if (!pointer) return;
      const r = svg.getBoundingClientRect();
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height * 0.38);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 160) * MAX_SHIFT;
      iris.setAttribute("transform", `translate(${(dx / d) * k} ${(dy / d) * k})`);
    };

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const style: WatcherStyle = { "--m-body": "#2e5fd9", "--m-iris": "#e63027" };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      width={SIZE}
      height={SIZE}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <use href="#cne-classic" />
      <circle cx={EYE_CX} cy={EYE_CY} r={30} fill="#fff8e7" />
      <g ref={irisRef}>
        <circle cx={EYE_CX} cy={EYE_CY} r={17} fill="#e63027" stroke="#14110d" strokeWidth={4} />
        <circle cx={EYE_CX} cy={EYE_CY} r={7} fill="#14110d" />
      </g>
    </svg>
  );
}
