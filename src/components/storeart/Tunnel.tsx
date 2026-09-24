"use client";

import { useEffect, useState } from "react";
import { Monster } from "@/components/mascots/Monster";
import { TUNNEL, tunnelPath } from "./tunnelPath";

/**
 * The checkerboard tunnel from the Hollywood mural (the one the monsters are
 * being pulled into), still rather than spinning, with a single monster
 * sitting in the mouth of it.
 *
 * Used where a location has no photo of its own yet (Glendale, Van Nuys), so
 * the page still carries the store's art instead of an empty frame. The
 * monster wears the store's own colour (`locationArt.ts`) and sleeps while
 * the store has no opening date.
 *
 * The rings are drawn on the client after hydration, the way the `Vortex`
 * band draws its own: server-rendered, their ~190 cells cost the page about
 * 20 KB of HTML and React payload, and as an image file they became the
 * page's largest paint and pushed its LCP on a phone from 0.7s to 1.4s. An
 * inline SVG is never an LCP candidate, so the store name stays the LCP.
 */
export function Tunnel({
  body,
  iris,
  asleep = false,
}: {
  body: string;
  iris: string;
  asleep?: boolean;
}) {
  const [d, setD] = useState("");
  useEffect(() => setD(tunnelPath()), []);

  return (
    <div className="cne-tunnel" aria-hidden="true">
      <svg
        viewBox={`0 0 ${TUNNEL.W} ${TUNNEL.H}`}
        preserveAspectRatio="xMidYMid slice"
        className="cne-tunnel-rings"
        focusable="false"
      >
        <path d={d} fill="#1a1612" className={d ? "is-drawn" : undefined} />
      </svg>
      <Monster
        species={asleep ? "classic-sleep" : "classic"}
        bodyColor={body}
        irisColor={iris}
        size={160}
        className="cne-tunnel-mon"
      />
    </div>
  );
}
