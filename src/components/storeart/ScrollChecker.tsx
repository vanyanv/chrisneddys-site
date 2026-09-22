"use client";

import { useEffect, useRef } from "react";
import "@/styles/menu-art.css";

/**
 * Idea 12. A checkerboard strip fixed to the very top of the viewport that
 * fills left to right with scroll progress, /menu only. A passive scroll
 * listener throttled to one measurement per frame — plain width, not a CSS
 * scroll-driven animation, so it works the same everywhere. Reduced motion
 * still updates the fill; only the smoothing transition is turned off, in
 * `menu-art.css`.
 */
export function ScrollChecker() {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    const measure = () => {
      ticking = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      if (fillRef.current) fillRef.current.style.width = `${pct * 100}%`;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="cne-scrollbar-track" aria-hidden="true">
      <div ref={fillRef} className="cne-scrollbar-fill" />
    </div>
  );
}
