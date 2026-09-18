"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TABS } from "@/components/counter/SiteHeader";

/**
 * Warms the six header destinations, but only once the page the visitor asked
 * for is finished and the browser is idle.
 *
 * Next's own `<Link prefetch>` fires the moment a link enters the viewport,
 * which for the tab strip means immediately, on every page — 143 KB of other
 * people's pages competing with the hero image for the connection during the
 * exact window that decides how fast this page feels. That is why every
 * storefront link carries `prefetch={false}` (see `SiteHeader.tsx`).
 *
 * The bytes were never the objection, though; the timing was. Fetched after
 * `load`, in idle time, the same six payloads cost nothing a visitor can
 * perceive and buy back the instant navigation that `prefetch={false}` gave
 * up. So this is not a partial retreat from that change — it is the half of
 * it that was always meant to come back.
 *
 * Deliberately just the tab strip. The links that made prefetching expensive
 * were the ones that scale with how far a page is read — the footer's legal
 * pages, the location cards, the menu's thirty item links — and those stay
 * off. Six is a bounded set, and Next's router cache holds them for the rest
 * of the visit, so this runs once per page view and mostly finds its work
 * already done.
 *
 * Three guards, all of them about not spending someone else's money:
 *
 *  - `saveData` — the visitor has explicitly asked their browser to use less
 *    data. Speculative downloads are the first thing that request means.
 *  - `effectiveType` of 2g or slow-2g — six payloads would still be arriving
 *    when they tap, so they would pay for them and wait anyway.
 *  - The current path is skipped, since it is already here.
 *
 * `requestIdleCallback` between each one rather than firing all six at once:
 * the router cache is the point, not the race, and a burst of six requests on
 * a phone that has just finished loading a page is exactly the contention this
 * component exists to avoid. Safari has no `requestIdleCallback`, so it falls
 * back to a timeout.
 */
export function PrefetchNav() {
  const router = useRouter();
  const raw = usePathname() ?? "/";
  const path = raw === "/" ? "/" : raw.endsWith("/") ? raw : `${raw}/`;

  useEffect(() => {
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return;

    const queue = TABS.map((t) => t.href).filter((href) => href !== path);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const idle = (fn: () => void) => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback;
      if (ric) ric(fn);
      else timers.push(setTimeout(fn, 300));
    };

    const next = () => {
      if (cancelled) return;
      const href = queue.shift();
      if (!href) return;
      // Never let a prefetch surface as an error to the visitor: this is
      // speculative work and a failed guess costs nothing.
      try {
        router.prefetch(href);
      } catch {
        /* ignore */
      }
      idle(next);
    };

    // `load`, not `DOMContentLoaded`: the images are the point. On the home
    // page the hero is still arriving well after the document is parsed, and
    // starting six fetches alongside it is the behaviour being avoided.
    const start = () => idle(next);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      for (const t of timers) clearTimeout(t);
    };
  }, [router, path]);

  return null;
}
