"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

/**
 * The lime monster in the bottom-right corner (idea 15). Fades in once
 * you're about 1.5 screens down, hops you back to the top on click.
 *
 * Two things it has to stay out of the way of: the fixed OrderDock, which
 * only renders on a phone and only off `/shop` — so its height is read at
 * runtime, not assumed, and pushed into `--cne-backtop-dock` for
 * `chrome-art.css` to add to the button's own offset. And the bag drawer /
 * item sheet, both of which lock `document.body.style.overflow` to "hidden"
 * while open — the same signal this reads to hide the button rather than
 * leave it floating over a modal scrim.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [hop, setHop] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.5);
    const updateDock = () => {
      const dock = document.querySelector<HTMLElement>(".cne-dock");
      const h = dock ? dock.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty("--cne-backtop-dock", h ? `${h}px` : "0px");
    };
    onScroll();
    updateDock();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateDock);
    // Catches the dock mounting/unmounting (route change onto or off `/shop`)
    // without waiting for the next scroll or resize.
    const dockObserver = new MutationObserver(updateDock);
    dockObserver.observe(document.body, { childList: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateDock);
      dockObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const checkOverlay = () => setOverlayOpen(document.body.style.overflow === "hidden");
    checkOverlay();
    const overlayObserver = new MutationObserver(checkOverlay);
    overlayObserver.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => overlayObserver.disconnect();
  }, []);

  const toTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    if (reduced) return;
    setHop(false);
    requestAnimationFrame(() => setHop(true));
  };

  return (
    <button
      type="button"
      className={`cne-backtop${visible && !overlayOpen ? " is-visible" : ""}${hop ? " is-hop" : ""}`}
      onClick={toTop}
      onAnimationEnd={() => setHop(false)}
      tabIndex={visible && !overlayOpen ? 0 : -1}
    >
      {/* Visible words so nobody has to guess what the monster is for; they
          double as the button's accessible name. */}
      <span className="cne-backtop-label">Scroll up</span>
      <svg
        viewBox="0 0 200 200"
        style={{ "--m-body": "#c6ff2b", "--m-iris": "#e63027" } as CSSProperties}
        aria-hidden="true"
      >
        <use href="#cne-classic" />
      </svg>
    </button>
  );
}
