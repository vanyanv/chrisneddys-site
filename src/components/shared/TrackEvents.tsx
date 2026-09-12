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
 * hit; `track()` asks GA4 for `transport_type: 'beacon'`, which is what keeps a
 * hit alive across an unload, and undercounting is the right failure direction
 * for an intent metric anyway.
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
      // link it wraps. A link with no declared surface sends no `surface` at
      // all: the pathname used to be substituted here, which put `/menu/` and
      // `dock` in the same dimension and made it impossible to read. GA4
      // already records the path as `page_location`.
      const surface =
        (anchor.closest("[data-surface]") as HTMLElement | null)?.dataset.surface || undefined;
      // Which store this link belongs to, declared the same way. All three
      // locations share one phone number today, so `call_click` cannot say
      // which counter was rung — and each store gets its own number as it
      // opens, at which point the answer has to already be in the history.
      const locationId =
        (anchor.closest("[data-location]") as HTMLElement | null)?.dataset.location || undefined;
      const itemId = anchor.dataset.item || undefined;

      let event: TrackEvent | null = null;
      const props: Record<string, string | undefined> = {
        surface,
        location: locationId,
        item_id: itemId,
      };

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
          // No `campaign` param: the `utm_campaign` baked into the href is the
          // surface by another name, and now that every order link declares a
          // `data-surface` the two were the same column twice. Otter's own
          // report still shows it, which is what it was for.
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
