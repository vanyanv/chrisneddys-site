"use client";

import { useEffect, useRef } from "react";
import { clearBag } from "./bagStore";

/**
 * Renders nothing. Mounted once on the paid branch of `/shop/thanks/` to
 * empty the bag the customer just paid for — a `useRef` guard rather than
 * relying on the effect's own once-per-mount behaviour, since a meta-refresh
 * or a fast client navigation back to this same page must not re-fire it
 * against a bag the customer has since started refilling.
 */
export function ClearBagOnce() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    clearBag();
  }, []);

  return null;
}
