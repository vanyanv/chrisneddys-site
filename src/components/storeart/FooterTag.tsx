"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Slide or Die" (idea 4), next to the footer's "Sliders" signature. It
 * writes itself in marker, left to right, the first time the footer scrolls
 * into view, then stays written. Under reduced motion `chrome-art.css`
 * shows it fully with no wipe, so the reduced-motion branch here just skips
 * the observer rather than firing an animation nobody should see.
 */
export function FooterTag() {
  const ref = useRef<HTMLSpanElement>(null);
  const [written, setWritten] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWritten(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setWritten(true);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // The observer watches the outer span; the clipped inner one has no
    // visible area until it is written, so it would never count as in view.
    <span ref={ref} className={`cne-foot-tag${written ? " is-written" : ""}`}>
      <span className="cne-foot-tag-ink">Slide or Die</span>
    </span>
  );
}
