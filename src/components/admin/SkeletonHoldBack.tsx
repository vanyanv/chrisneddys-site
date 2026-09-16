"use client";

import { useEffect, useState } from "react";
import { scheduleHoldBack } from "./skeletonHoldBack";

export { SKELETON_HOLD_MS } from "./skeletonHoldBack";

/**
 * Delays rendering `children` by `SKELETON_HOLD_MS` (see
 * `skeletonHoldBack.ts`). Each admin `loading.tsx` wraps only its
 * skeletonised *body* in this — the card grid, the detail panel, the table
 * rows, the edition grid — not the whole page: the top bar, tab strip and
 * page title render outside it and stay on screen from the first paint,
 * so a route that resolves before the hold is up never paints a skeleton
 * the person only catches as a blink, and a route that takes longer never
 * drops the frame to a blank viewport for those 200ms either (issue #46's
 * follow-up — an earlier version of this component wrapped the entire
 * loading tree, chrome included, which traded one flash for the other).
 *
 * Renders `null` while holding, not a placeholder box, so the region it
 * wraps has nothing to reserve, collapse or reflow when it appears — that
 * only holds, though, for the chrome each `loading.tsx` renders around it:
 * callers are responsible for putting the hold only where the surrounding
 * layout doesn't depend on its content's size (below a header whose own
 * height comes from a title next to it, for instance, not inline with one).
 *
 * The hold is a plain `setTimeout`, not a CSS transition or animation, so
 * it is unaffected by `prefers-reduced-motion`'s blanket
 * `animation-duration`/`transition-duration` override in `admin-rack.css`.
 * Reduced motion turns off the skeleton's breathing once it's shown; it
 * was never meant to touch whether the skeleton is held back in the first
 * place.
 */
export function SkeletonHoldBack({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => scheduleHoldBack(() => setShow(true)), []);

  if (!show) return null;
  return <>{children}</>;
}
