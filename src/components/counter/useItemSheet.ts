"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuItem, WayId } from "@/data/menu";
import { track } from "@/lib/track";

/**
 * Sheet state, shared by the menu and the home page's featured cards.
 *
 * `item` deliberately survives closing. If it were cleared, the sheet would
 * empty out and collapse to zero height — which breaks the animation at both
 * ends: the exit slide would have no content to carry, and the next open would
 * transition from a zero-height `translateY(102%)`, i.e. no travel at all.
 */
export function useItemSheet() {
  const [item, setItem] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);
  const [way, setWay] = useState<WayId>("chris");

  /**
   * `/menu/?way=eddy` opens the menu on that Way — the two buttons at the foot
   * of the story page are the only things that link it, and the promise there
   * is that the choice carries over.
   *
   * Read after mount rather than during render: the site is a static export,
   * so the HTML is built without a query string and reading one at render time
   * would be a hydration mismatch.
   */
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("way");
    if (asked === "chris" || asked === "eddy") setWay(asked);
  }, []);

  /**
   * The phone's Back gesture closes the sheet instead of leaving the menu.
   *
   * Opening pushes one history entry that belongs to the sheet; Back pops it
   * and the listener below shuts the sheet. Every other way out (✕, Escape,
   * the scrim, a drag) goes through `close`, which pops that same entry rather
   * than just hiding the sheet — otherwise it would be left behind, and the
   * next Back would appear to do nothing. Next's router patches `pushState`
   * (App Router history support), so the entry carries its own state and a
   * Back into it is a same-URL navigation, not a reload.
   */
  // Set while our own history.back() is in flight, so a second tap on close
  // before popstate lands doesn't step back past the menu page too.
  const leaving = useRef(false);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      leaving.current = false;
      if (!(e.state as { cneSheet?: boolean } | null)?.cneSheet) setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openItem = useCallback((next: MenuItem) => {
    setItem(next);
    setOpen(true);
    if (!(window.history.state as { cneSheet?: boolean } | null)?.cneSheet) {
      window.history.pushState({ ...window.history.state, cneSheet: true }, "");
    }
    // Opening a sheet is someone choosing food rather than reading a page. It
    // is the step before the handoff, and the only place a drop-off between
    // "looked at the Quad" and "went to buy the Quad" becomes visible.
    track("menu_item_open", { item_id: next.id, price: next.price });
  }, []);

  /** The combo suggestion: same sheet, same history entry, another item. */
  const switchItem = useCallback((next: MenuItem) => {
    setItem(next);
    track("menu_item_open", { item_id: next.id, price: next.price, surface: "item-sheet-combo" });
  }, []);

  const close = useCallback(() => {
    if (leaving.current) return;
    if ((window.history.state as { cneSheet?: boolean } | null)?.cneSheet) {
      leaving.current = true;
      window.history.back();
    } else {
      setOpen(false);
    }
  }, []);

  return { item, open, way, setWay, openItem, switchItem, close };
}
