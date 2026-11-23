"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "cne-marquee-paused";

/** Pause/play for the scrolling band it sits in (WCAG 2.2.2). Sets
 *  `data-paused` on the enclosing `.cne-mq`; the CSS does the pausing. The
 *  choice lasts the session. Storage is read in an effect so the server and
 *  first client render agree. */
export function MarqueeToggle() {
  const ref = useRef<HTMLButtonElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") setPaused(true);
    } catch {
      /* storage blocked: start playing */
    }
  }, []);

  useEffect(() => {
    const band = ref.current?.closest(".cne-mq");
    if (!band) return;
    if (paused) band.setAttribute("data-paused", "true");
    else band.removeAttribute("data-paused");
  }, [paused]);

  /* Scroll lean: the band speeds up with scroll velocity (reverses when
     scrolling up) and the CSS skews its words via --cne-mq-skew. Idle
     between scrolls; rAF runs only while moving. Skipped for reduced
     motion, and never reacts while paused. */
  useEffect(() => {
    const band = ref.current?.closest<HTMLElement>(".cne-mq");
    if (!band || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rate = (r: number) =>
      band.querySelectorAll(".cne-mq-track").forEach((t) => {
        // Reverse only with a couple of seconds already played, else hold
        // still: an animation run back past its start stops applying.
        t.getAnimations().forEach((a) => {
          a.playbackRate = r < 0 && Number(a.currentTime) < 2000 ? 0 : r;
        });
      });
    const rest = () => {
      rate(1);
      band.style.removeProperty("--cne-mq-skew");
    };
    let last = scrollY;
    let v = 0;
    let raf = 0;
    const tick = () => {
      const d = Math.max(-80, Math.min(80, scrollY - last));
      last = scrollY;
      if (band.hasAttribute("data-paused")) {
        v = raf = 0;
        rest();
        return;
      }
      v += (d - v) * 0.25;
      if (Math.abs(v) < 0.05 && !d) {
        v = raf = 0;
        rest();
        return;
      }
      const r = 1 + Math.min(9, Math.abs(v) * 0.35);
      rate(v < -0.5 ? -r : r);
      band.style.setProperty("--cne-mq-skew", Math.max(-22, Math.min(22, -v * 1.1)) + "deg");
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      if (raf) return;
      // `last` is where the page sat when the band last came to rest, so the
      // first frame already carries this scroll's distance. Paused: keep up
      // with the page so a resume does not replay the whole gap.
      if (band.hasAttribute("data-paused")) last = scrollY;
      else raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      rest();
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="cne-mq-toggle"
      aria-label="Pause scrolling text"
      aria-pressed={paused}
      onClick={() => {
        const next = !paused;
        setPaused(next);
        try {
          sessionStorage.setItem(KEY, next ? "1" : "0");
        } catch {
          /* storage blocked: the choice just won't carry over */
        }
      }}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
        {paused ? (
          <path d="M2 1l9 5-9 5z" fill="currentColor" />
        ) : (
          <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />
        )}
      </svg>
    </button>
  );
}
