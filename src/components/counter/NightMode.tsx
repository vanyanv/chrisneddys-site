"use client";

import { useEffect } from "react";
import { losAngelesNow } from "@/lib/hours";

/**
 * 2AM mode. The palette flips to the late-night one from 9 PM to 3 AM Los
 * Angeles time, which is when a meaningful share of this menu actually sells.
 *
 * The site is a static export, so the server can't know the hour — `data-mode`
 * is unset in the HTML and `:root` holds the day palette, so the first paint is
 * always valid and the flip happens on mount.
 */
export function NightMode() {
  useEffect(() => {
    const apply = () => {
      const { minutes } = losAngelesNow();
      const hour = Math.floor(minutes / 60);
      const night = hour >= 21 || hour < 3;
      document.documentElement.dataset.mode = night ? "night" : "day";
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
