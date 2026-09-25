"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";

/** Bars pinned to the bottom of a phone screen that the button sits above. */
const BOTTOM_BARS = [".cne-dock", ".cne-pdp-sticky"];

/** Matches the storefront's phone/tablet tier, where the button hides while
 * scrolling down. */
const PHONE_QUERY = "(max-width: 900px)";

/** How far a scroll has to travel in one direction before it counts, so a
 * finger's wobble doesn't flicker the button. */
const DIRECTION_SLOP = 24;

/**
 * The lime monster in the bottom-right corner (idea 15). Fades in once
 * you're about 1.5 screens down, hops you back to the top on click.
 *
 * Things it has to stay out of the way of: the bars pinned to the bottom of
 * a phone screen — the OrderDock (phone only, off `/shop`) and a product
 * page's sticky buy bar (issue #104) — so their heights are read at runtime,
 * not assumed, and pushed into `--cne-backtop-dock` for `chrome-art.css` to
 * add to the button's own offset. The bag drawer / item sheet, both of which
 * lock `document.body.style.overflow` to "hidden" while open — the same
 * signal this reads to hide the button rather than leave it floating over a
 * modal scrim. And, on a phone, whatever it would sit on while someone reads
 * down the page (menu prices): below `PHONE_QUERY` it only shows while
 * scrolling back up, which is when anyone wants it.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [hop, setHop] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const phone = window.matchMedia(PHONE_QUERY);
    let anchorY = window.scrollY;
    let goingUp = false;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < anchorY - DIRECTION_SLOP) {
        goingUp = true;
        anchorY = y;
      } else if (y > anchorY + DIRECTION_SLOP) {
        goingUp = false;
        anchorY = y;
      } else if (goingUp ? y < anchorY : y > anchorY) {
        anchorY = y;
      }
      setVisible(y > window.innerHeight * 1.5 && (goingUp || !phone.matches));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const updateDock = () => {
      let h = 0;
      for (const sel of BOTTOM_BARS) {
        const bar = document.querySelector<HTMLElement>(sel);
        // A bar hidden by CSS (the buy bar on desktop) measures 0.
        if (bar) h += bar.getBoundingClientRect().height;
      }
      document.documentElement.style.setProperty("--cne-backtop-dock", `${h}px`);
    };
    updateDock();
    window.addEventListener("resize", updateDock);
    // Catches the dock mounting/unmounting without waiting for the next
    // resize; the route change itself re-runs this effect via `pathname`.
    const dockObserver = new MutationObserver(updateDock);
    dockObserver.observe(document.body, { childList: true });
    return () => {
      window.removeEventListener("resize", updateDock);
      dockObserver.disconnect();
    };
  }, [pathname]);

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
        style={
          {
            "--m-body": MONSTER_COLORS.lime.body,
            "--m-iris": MONSTER_COLORS.lime.iris,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <use href="#cne-classic" />
      </svg>
    </button>
  );
}
