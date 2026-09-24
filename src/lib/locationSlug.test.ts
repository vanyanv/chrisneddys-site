import { describe, expect, it } from "vitest";
import { locationForPath } from "@/lib/locationSlug";

describe("locationForPath", () => {
  it("names the store a location page is for", () => {
    expect(locationForPath("/locations/van-nuys/")).toMatchObject({
      loc: { id: "vannuys" },
      onLocationPage: true,
    });
    expect(locationForPath("/locations/glendale")).toMatchObject({
      loc: { id: "glendale" },
      onLocationPage: true,
    });
  });

  it("falls back to Hollywood everywhere else", () => {
    for (const path of ["/", "/menu/", "/locations/", "/locations/nowhere/"]) {
      expect(locationForPath(path)).toMatchObject({
        loc: { id: "hollywood" },
        onLocationPage: false,
      });
    }
  });
});
