"use client";

import { useEffect } from "react";

/**
 * Scroll reveals, matching the prototype: sections marked `.cne-rv` fade and
 * rise once as they come into view, staggered in fours.
 *
 * Anything already on screen at load is revealed immediately rather than
 * waiting for a scroll, so the first frame is the finished page.
 */
export function RevealRoot() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".cne-rv"));
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    nodes.forEach((n, i) => {
      n.style.transitionDelay = `${(i % 4) * 60}ms`;
      io.observe(n);
    });
    // Whatever is already above the fold shouldn't wait for a scroll event.
    requestAnimationFrame(() => {
      nodes.forEach((n) => {
        if (n.getBoundingClientRect().top < window.innerHeight) n.classList.add("is-in");
      });
    });
    return () => io.disconnect();
  }, []);

  return null;
}
