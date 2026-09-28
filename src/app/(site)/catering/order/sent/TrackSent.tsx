"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/** Fires once, when C10 loads — the request-sent conversion event. */
export function TrackSent({ number }: { number: string }) {
  useEffect(() => {
    track("catering_order_request_sent", { surface: "catering-order-sent", number });
  }, [number]);
  return null;
}
