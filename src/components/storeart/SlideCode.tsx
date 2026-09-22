"use client";

import { useEffect, useRef, useState } from "react";
import { Vortex } from "./Vortex";
import "@/styles/vortex.css";

/**
 * Idea 14. Type S-L-I-D-E anywhere on the page (desktop, fine pointer only)
 * and the page gets pulled into the checkerboard vortex, then pops right
 * back — about 1.8s total.
 *
 * Not mounted in the layout by this brief — see the report for the one line
 * to add there. The `Vortex` overlay itself isn't rendered until the code is
 * actually typed once, so nobody pays for its polygons on a page load that
 * never uses it.
 */

const CODE = "SLIDE";
const IN_MS = 900;
const TOTAL_MS = 1800;

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export function SlideCode() {
  const [primed, setPrimed] = useState(false);
  const [everTriggered, setEverTriggered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const bufferRef = useRef("");
  const busyRef = useRef(false);

  // Desktop + fine pointer only, checked once on mount.
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const desktop = window.matchMedia("(min-width: 901px)").matches;
    setPrimed(fine && desktop);
  }, []);

  useEffect(() => {
    if (!primed) return;

    const play = () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setEverTriggered(true);

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const focused = document.activeElement as HTMLElement | null;
      const main = document.getElementById("main");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const restore = () => {
        setPlaying(false);
        main?.classList.remove("cne-slide-target", "is-gone");
        window.scrollTo(scrollX, scrollY);
        focused?.focus?.({ preventScroll: true });
        busyRef.current = false;
      };

      if (reduced) {
        // Reduced motion: a simple fade of the overlay, page untouched.
        setPlaying(true);
        window.setTimeout(restore, 400);
        return;
      }

      main?.classList.add("cne-slide-target");
      // Two rAFs so the browser commits the pre-transition frame before the
      // "is-gone" class is added, or the scale-in transition never plays.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPlaying(true);
          main?.classList.add("is-gone");
        });
      });
      window.setTimeout(() => main?.classList.remove("is-gone"), IN_MS);
      window.setTimeout(restore, TOTAL_MS);
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.key.length !== 1) return;
      bufferRef.current = (bufferRef.current + e.key.toUpperCase()).slice(-CODE.length);
      if (bufferRef.current === CODE) {
        bufferRef.current = "";
        play();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [primed]);

  if (!primed || !everTriggered) return null;

  return (
    <div className={`cne-slidecode${playing ? " is-on" : ""}`} aria-hidden="true">
      <Vortex variant="screen" />
    </div>
  );
}
