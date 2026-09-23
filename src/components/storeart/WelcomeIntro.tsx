"use client";

import { useEffect, useRef, useState } from "react";
import { Vortex } from "./Vortex";
import { INTRO_GATE_CLASS, INTRO_GATE_SCRIPT } from "@/lib/intro";
import "@/styles/intro.css";

/** Logo zooms in this long after mount (see `.cne-intro-logo`'s animation-delay). */
const EXIT_START_MS = 2400;
/** How long the "whole overlay scales and rotates out" transition takes. */
const EXIT_DURATION_MS = 600;

/**
 * Home page only (issues #81, #102): the welcome vortex, every desktop visit — see
 * `src/lib/intro.ts` for the gating rules and `src/styles/intro.css` for the
 * curtain that keeps this flash-free.
 *
 * The inline script this renders decides, synchronously and before
 * hydration, whether this visit gets the intro; if so it adds
 * `INTRO_GATE_CLASS` to `<html>`, which the CSS curtain keys
 * off immediately — no waiting on React. This component then notices the
 * class, mounts the actual vortex + logo inside that already-covered
 * viewport, and on any click/key/wheel/touch (or after ~2.4s) plays the same
 * exit every time before removing the class and unmounting — gone from the
 * DOM by about 3s. For everyone else it renders an empty, `display: none`
 * curtain div and nothing more: no listeners, no vortex polygons.
 */
export function WelcomeIntro() {
  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Lets the skip button call the same function the window-level listeners
  // use, without redeclaring it outside the effect that owns its timers.
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      if (document.documentElement.classList.contains(INTRO_GATE_CLASS)) {
        setActive(true);
      }
    } catch {
      // Storage/DOM access failed — stay inactive, matching the gate script's
      // own try/catch (a throw anywhere means no intro).
    }
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    let skipped = false;
    let doneTimer: number | undefined;

    const goExit = () => {
      setExiting(true);
      doneTimer = window.setTimeout(() => {
        try {
          document.documentElement.classList.remove(INTRO_GATE_CLASS);
        } catch {
          // no-op — worst case the (already invisible, unmounting) curtain
          // class lingers on <html> with nothing left to show.
        }
        setActive(false);
      }, EXIT_DURATION_MS);
    };

    const exitTimer = window.setTimeout(goExit, EXIT_START_MS);

    const skip = () => {
      if (skipped) return;
      skipped = true;
      window.clearTimeout(exitTimer);
      goExit();
    };
    skipRef.current = skip;

    // Space/arrow keys otherwise scroll the page underneath while the
    // overlay is mid-exit — block just those, so shortcuts like reload and
    // Tab still work.
    const SCROLL_KEYS = new Set([" ", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);
    const onKeydown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) e.preventDefault();
      skip();
    };

    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, [active]);

  return (
    <>
      {/* Raw JS, not TSX — runs before hydration. Mirrors shouldShowIntro()
          in src/lib/intro.ts; see the comment on INTRO_GATE_SCRIPT there. */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_GATE_SCRIPT }} />
      <div className={`cne-intro-overlay${exiting ? " is-out" : ""}`} aria-hidden="true">
        {active && (
          <>
            <Vortex variant="screen" />
            <img
              className="cne-intro-logo"
              src="/cne-logo-lg.webp"
              onError={(e) => {
                const img = e.currentTarget;
                img.onerror = null;
                img.src = "/cne-logo-lg.png";
              }}
              alt=""
              width={1236}
              height={348}
            />
          </>
        )}
      </div>
      {/* Outside the aria-hidden overlay — the one non-decorative, focusable
          part of this intro. */}
      {active && (
        <button type="button" className="cne-intro-skip" onClick={() => skipRef.current()}>
          Skip intro
        </button>
      )}
    </>
  );
}
