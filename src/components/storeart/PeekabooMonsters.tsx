"use client";

import { useEffect } from "react";

/**
 * Idea 16. One shared IntersectionObserver watches every menu category
 * heading (`[data-peek-section]`); the first time one scrolls into view, its
 * mascot (`[data-peek-mon]`) plays the one-shot peek-and-duck animation
 * defined in `menu-art.css`. Each heading is unobserved right after it fires,
 * so it plays once per page view. Does nothing under reduced motion.
 */
export function PeekabooMonsters() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const sections = document.querySelectorAll<HTMLElement>("[data-peek-section]");
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          entry.target.querySelector<HTMLElement>("[data-peek-mon]")?.classList.add("cne-peeking");
        }
      },
      { threshold: 0.5 },
    );
    sections.forEach((section) => io.observe(section));

    return () => io.disconnect();
  }, []);

  return null;
}
