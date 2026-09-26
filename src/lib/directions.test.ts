import { describe, expect, it } from "vitest";
import { locations } from "@/data/locations";
import { appleDirections, googleDirections, mapsQuery } from "@/lib/directions";

const store = (id: string) => {
  const loc = locations.find((l) => l.id === id);
  if (!loc) throw new Error(id);
  return loc;
};

describe("directions", () => {
  it("routes Van Nuys to its own street address, not a brand-name search", () => {
    // "Chris N Eddy's, 14523 Sherman Way, ..." matched the Hollywood listing.
    const vn = store("vannuys");
    expect(mapsQuery(vn)).toBe("14523 Sherman Way, Van Nuys, CA 91405");
    expect(googleDirections(vn)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=14523%20Sherman%20Way%2C%20Van%20Nuys%2C%20CA%2091405",
    );
    expect(appleDirections(vn)).toBe(
      "https://maps.apple.com/?daddr=14523%20Sherman%20Way%2C%20Van%20Nuys%2C%20CA%2091405",
    );
  });

  it("names the brand only for a store the maps apps already list", () => {
    expect(mapsQuery(store("hollywood"))).toBe(
      "Chris N Eddy's, 5539 W. Sunset Blvd, Los Angeles, CA 90028",
    );
    for (const loc of locations.filter((l) => !l.listedOnMaps)) {
      expect(mapsQuery(loc)).not.toContain("Chris N Eddy");
      expect(mapsQuery(loc)).toContain(loc.address);
    }
  });
});
