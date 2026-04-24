"use client";

import { useEffect } from "react";

export function ScrollVar(): null {
  useEffect(() => {
    const mq = window.matchMedia(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)"
    );
    if (!mq.matches) return;

    let raf = 0;
    const update = () => {
      document.documentElement.style.setProperty("--cne-sy", window.scrollY + "px");
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
