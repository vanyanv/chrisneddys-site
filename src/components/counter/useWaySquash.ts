"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { WayId } from "@/data/menu";
import { onScreen, reducedMotion } from "@/lib/motion";

/**
 * Switching Way swaps item photos; each one that changes and is on screen gets
 * squashed in, 70ms apart. Driven by `way` itself, so the first render (no
 * earlier photos to compare with) does nothing. The menu's lead photo is the
 * owner's one exception: it never animates.
 */
export function useWaySquash(main: RefObject<HTMLElement | null>, way: WayId) {
  const seen = useRef<Map<Element, string | null> | null>(null);
  useLayoutEffect(() => {
    const imgs = Array.from(main.current?.querySelectorAll("img") ?? []);
    const before = seen.current;
    seen.current = new Map(imgs.map((i) => [i, i.getAttribute("src")]));
    if (!before || reducedMotion()) return;
    imgs
      .filter(
        (i) => !i.closest(".cne-lead") && before.get(i) !== i.getAttribute("src") && onScreen(i),
      )
      .forEach((img, n) => {
        const o = "50% 85%";
        img.animate(
          [
            { transform: "scale(1.5, 0.35)", opacity: 0.2, offset: 0, transformOrigin: o },
            { transform: "scale(1.12, 0.8)", opacity: 1, offset: 0.35, transformOrigin: o },
            { transform: "scale(0.95, 1.07)", offset: 0.65, transformOrigin: o },
            { transform: "none", transformOrigin: o },
          ],
          {
            duration: 460,
            delay: n * 70,
            easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
            fill: "backwards",
          },
        );
      });
  }, [main, way]);
}
