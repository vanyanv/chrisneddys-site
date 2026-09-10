"use client";

import { useEffect } from "react";
import { track, type TrackEvent } from "@/lib/track";
import { platformByHost } from "@/data/delivery";

/**
 * One delegated listener for every conversion click on the site.
 *
 * The alternative is an `onClick` on each of the twenty-odd order, call and
 * directions links, which means every new link is untracked until someone
 * remembers — and the thing that goes untracked is always the one that matters.
 * Listening on the document instead makes tracking the default: a link is
 * classified by where it points, so a link added tomorrow is measured today.
 *
 * `auxclick` is bound alongside `click` because on desktop a middle-click opens
 * the storefront in a background tab and fires no `click` at all. Both are
 * bound in the capture phase so a handler that stops propagation — the item
 * sheet's, for one — cannot silently swallow the event.
 *
 * Nothing here calls `preventDefault`, so navigation is never delayed or
 * blocked by analytics. The trade is that a click leaving the page may lose the
 * beacon on a slow connection; GA4 and Plausible both send these over the
 * browser's keepalive transport, which is the mitigation, and undercounting is
 * the right failure direction for an intent metric anyway.
 */
export function TrackEvents() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Ignore right-click; keep left and middle.
      if (e.type === "auxclick" && (e as MouseEvent).button !== 1) return;

      const target = e.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const raw = anchor.getAttribute("href") || "";

      // The surface is declared by the nearest ancestor that claims one, so a
      // button inside the dock reports "dock" without the dock knowing which
      // link it wraps.
      const surface =
        (anchor.closest("[data-surface]") as HTMLElement | null)?.dataset.surface || undefined;
      const item = anchor.dataset.item || undefined;

      let event: TrackEvent | null = null;
      const props: Record<string, string | undefined> = { surface, item };

      if (raw.startsWith("tel:")) {
        event = "call_click";
      } else {
        let url: URL | null = null;
        try {
          url = new URL(raw, window.location.href);
        } catch {
          return;
        }
        const host = url.hostname;

        if (host === "order.tryotter.com") {
          event = "order_click";
          // The campaign baked into the href is the same value Otter's own
          // report will show, so sending it makes the two joinable by hand.
          props.campaign = url.searchParams.get("utm_campaign") || undefined;
        } else if (host in platformByHost) {
          event = "delivery_click";
          props.platform = platformByHost[host];
        } else if (
          host === "www.google.com" ||
          host === "google.com" ||
          host === "maps.apple.com"
        ) {
          if (url.pathname.includes("/maps")) event = "directions_click";
          else if (host === "maps.apple.com") event = "directions_click";
        }
      }

      if (!event) return;
      // The page is worth more than the surface on a link that declares none.
      if (!props.surface) props.surface = window.location.pathname;
      track(event, props);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}
