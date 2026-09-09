"use client";

import { useCallback, useEffect, useState } from "react";
import type { MenuItem } from "@/data/menu";
import type { WayId } from "./ItemSheet";

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

  const openItem = useCallback((next: MenuItem) => {
    setItem(next);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return { item, open, way, setWay, openItem, close };
}
