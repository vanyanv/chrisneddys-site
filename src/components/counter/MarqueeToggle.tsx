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
