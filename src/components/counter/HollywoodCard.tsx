"use client";

import { useEffect, useState } from "react";
import { locations } from "@/data/locations";
import { brand } from "@/data/brand";
import { orderUrl } from "@/lib/otter";
import { googleDirections, appleDirections, prefersAppleMaps } from "@/lib/directions";
import { OpenStatus } from "@/components/shared/OpenStatus";

/** The Hollywood store card the prototype puts on the home page. */
export function HollywoodCard() {
  const loc = locations.find((l) => l.id === "hollywood") ?? locations[0];
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(prefersAppleMaps()), []);

  return (
    <div className="cne-loc is-live">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h3>{loc.name.toUpperCase()}</h3>
        <OpenStatus locationId={loc.id} />
      </div>
      <div className="cne-loc-addr">
        {loc.address}
        <br />
        {loc.city}, {loc.region} {loc.postal}
      </div>
      <div className="cne-loc-hrs">
        {loc.hours.map(([day, hrs]) => (
          <div className="r" key={day}>
            <span>{day.toUpperCase()}</span>
            <b>{hrs}</b>
          </div>
        ))}
      </div>
      <div className="cne-loc-btns">
        <a className="cne-mini is-red" href={orderUrl("location-card")} target="_blank" rel="noopener noreferrer">
          ORDER
        </a>
        <a
          className="cne-mini is-plain"
          href={apple ? appleDirections(loc) : googleDirections(loc)}
          target="_blank"
          rel="noopener noreferrer"
        >
          DIRECTIONS
        </a>
        <a className="cne-mini is-plain" href={`tel:${brand.phoneTel}`}>
          CALL
        </a>
      </div>
    </div>
  );
}
