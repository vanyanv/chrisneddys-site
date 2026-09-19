"use client";

import { useEffect, useRef } from "react";
import { track, type TrackItem } from "@/lib/track";
import { claimPurchase } from "./purchaseDedupe";

export type PurchaseOrder = {
  id: string;
  number: string;
  value: number;
  currency: string;
  items: TrackItem[];
};

/**
 * Renders nothing. Mounted once on the paid branch of `/shop/thanks/` to
 * fire GA4's `purchase` event for that order.
 *
 * Guarded twice, for two different repeats: a `useRef`, same as
 * `ClearBagOnce.tsx`, against this component re-running its effect within
 * one page life (React 19's dev double-invoke); `claimPurchase`, keyed on
 * `order.id` in `sessionStorage`, against the *page* reloading — a refresh
 * of this URL, or the `?try=` meta-refresh above re-rendering this same
 * paid order. `sessionStorage` throws in some privacy modes, so that call is
 * wrapped in try/catch — without it to dedupe against, this still sends the
 * event once for this mount rather than dropping the conversion outright.
 */
export function PurchaseOnce({ order }: { order: PurchaseOrder }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    let alreadySent = false;
    try {
      alreadySent = !claimPurchase(window.sessionStorage, order.id);
    } catch {
      // Private mode, a full quota, a browser told to block site data.
    }
    if (alreadySent) return;

    track("purchase", {
      transaction_id: order.number,
      value: order.value,
      currency: order.currency.toUpperCase(),
      items: order.items,
    });
  }, [order]);

  return null;
}
