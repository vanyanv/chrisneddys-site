"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll reveals, matching the prototype: sections marked `.cne-rv` fade and
 * rise once as they come into view, staggered in fours.
 *
 * Anything already on screen at load is revealed immediately rather than
 * waiting for a scroll, so the first frame is the finished page.
 *
 * Keyed on the pathname because this lives in the root layout, which survives
 * client-side navigation. The nodes are collected once per effect run, so a
 * mount-only effect would never see the sections that arrive with the next
 * route — and `.js .cne-rv` holds them at `opacity: 0` until `is-in` lands,
 * which would leave the whole menu invisible to anyone who got there from the
 * header rather than by typing the URL.
 */
export function RevealRoot() {
  const pathname = usePathname();

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
    const raf = requestAnimationFrame(() => {
      nodes.forEach((n) => {
        if (n.getBoundingClientRect().top < window.innerHeight) n.classList.add("is-in");
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
