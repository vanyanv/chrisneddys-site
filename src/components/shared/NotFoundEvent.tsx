"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import { GA_INIT } from "@/components/shared/Analytics";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

/**
 * Renders nothing. Mounted on both 404 pages to report which address was
 * missing and what linked to it — the only way an old link from the previous
 * site, a typo on a flyer or a stale listing on another site ever shows up in
 * GA4. The page_view alone says only "Page not found", and every dead link
 * has that same title.
 *
 * A dead `/menu/<item>/` or `/locations/<slug>/` is answered with the root
 * not-found page drawn by React in the browser rather than as HTML, and React
 * never runs an inline `<script>` it renders — so on those pages the GA4
 * snippet is present but inert. Running the same snippet here when no tag has
 * started covers them; it keeps its own hostname gate.
 */
export function NotFoundEvent() {
  useEffect(() => {
    if (GA_MEASUREMENT_ID && !window.gtag) {
      const s = document.createElement("script");
      s.text = GA_INIT;
      document.head.appendChild(s);
    }
    track("page_not_found", {
      missing_path: window.location.pathname,
      came_from: document.referrer || undefined,
    });
  }, []);

  return null;
}
