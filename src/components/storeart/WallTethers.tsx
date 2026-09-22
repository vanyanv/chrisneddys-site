"use client";

import { useEffect, useRef } from "react";
import "@/styles/home-art.css";

/**
 * Idea 6. Two squiggly tethers, red and blue, behind "The three we sell
 * most" cards — like the painted tethers between monsters on the wall.
 * Draws itself once via stroke-dash when the block scrolls into view.
 * Desktop only (see `home-art.css`): below the `.cne-cardgrid` breakpoint
 * the cards stack into a single column and there's nothing to connect.
 */

const RED = "M210,92 C330,46 390,162 510,115 S690,46 600,173";
const BLUE = "M600,173 C720,219 780,104 900,150 S1050,242 990,219";

export function WallTethers() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      node.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          node.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={svgRef}
      className="cne-tethers"
      viewBox="0 0 1200 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={RED} fill="none" stroke="#e63027" strokeWidth={8} strokeLinecap="round" />
      <path
        d={BLUE}
        fill="none"
        stroke="#2e5fd9"
        strokeWidth={8}
        strokeLinecap="round"
        className="is-b"
      />
    </svg>
  );
}
