"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import { MonsterEye } from "@/components/mascots/MonsterEye";

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
/** How far the iris may travel, in the art's 1000-unit grid (`MonsterEye`):
 * the artist's eye is a wide oval, so it has more room sideways than up and
 * down. */
const MAX_SHIFT_X = 60;
const MAX_SHIFT_Y = 35;
const { body: BODY, iris: IRIS } = MONSTER_COLORS.blue;

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
      const dy = pointer.y - (r.top + r.height * 0.32);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 160);
      iris.setAttribute(
        "transform",
        `translate(${(dx / d) * k * MAX_SHIFT_X} ${(dy / d) * k * MAX_SHIFT_Y})`,
      );
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

  const style: WatcherStyle = { "--m-body": BODY, "--m-iris": IRIS };

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
      <MonsterEye body={BODY} iris={IRIS} irisRef={irisRef} />
    </svg>
  );
}
