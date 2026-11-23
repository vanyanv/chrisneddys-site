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
    // `.cne-pins` (the home map) hides its pins only once marked `is-arm`
    // here, so a page where this never runs keeps them visible. The pins drop
    // in when the map is mostly on screen, later than a section's reveal, so
    // the sweep below handles them and the observer does not.
    const pins = Array.from(document.querySelectorAll<HTMLElement>(".cne-pins"));
    pins.forEach((n) => n.classList.add("is-arm"));
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".cne-rv"));
    if (nodes.length + pins.length === 0) return;

    const show = (n: HTMLElement) => n.classList.add("is-in");

    if (!("IntersectionObserver" in window)) {
      nodes.concat(pins).forEach(show);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
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

    /**
     * Reveal everything the viewport has already reached or passed.
     *
     * The observer alone is not enough: jump far enough in one go — a menu
     * category link, a hash landing, restored scroll, a flick on a phone — and
     * a section can go from below the fold to above it without ever being
     * intersecting, so no entry is ever delivered and it stays at `opacity: 0`
     * for good. Scrolling back up then finds a blank gap.
     */
    let queued = false;
    const sweep = () => {
      queued = false;
      // Read every position first, then reveal. Interleaving the two made the
      // browser redo layout once per section, on every scrolled frame.
      const fold = window.innerHeight;
      const due = nodes.filter(
        (n) => !n.classList.contains("is-in") && n.getBoundingClientRect().top < fold,
      );
      const drop = pins.filter(
        (n) => !n.classList.contains("is-in") && n.getBoundingClientRect().top < fold * 0.55,
      );
      due.forEach((n) => {
        show(n);
        io.unobserve(n);
      });
      drop.forEach(show);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sweep);
    };

    const raf = requestAnimationFrame(sweep);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
