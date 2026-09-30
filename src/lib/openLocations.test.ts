import { describe, expect, it } from "vitest";
import { sharedFaq } from "@/data/faq";
import { locations } from "@/data/locations";
import {
  closingLine,
  deliverySentence,
  joinNames,
  openHoursAnswer,
  openNames,
  phoneList,
} from "./openLocations";
import { orderTargetUrl } from "./orderChoice";

const byId = (id: string) => locations.find((l) => l.id === id)!;

describe("sitewide copy names every open store, not just Hollywood (issue #178)", () => {
  it("joins names the way a sentence does", () => {
    expect(joinNames(["Hollywood"])).toBe("Hollywood");
    expect(joinNames(["Hollywood", "Van Nuys"], "or")).toBe("Hollywood or Van Nuys");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
  });

  it("speaks for both open stores", () => {
    expect(openNames("or")).toBe("Hollywood or Van Nuys");
    expect(openHoursAnswer()).toMatch(/^Late\. Hollywood and Van Nuys are both open 10 AM/);
    expect(closingLine()).toMatch(/^Hollywood and Van Nuys both serve until 1 AM/);
    expect(deliverySentence()).toBe(
      "DoorDash and Uber Eats deliver from Hollywood and Van Nuys, and Grubhub from Hollywood",
    );
    expect(phoneList()).toBe("Hollywood (323) 544-3600, Van Nuys (818) 208-9315");
    for (const { a } of sharedFaq) expect(a).not.toMatch(/The Hollywood location/);
  });
});

describe("where ORDER goes for each store", () => {
  const item = { name: "The Slider", otterId: "abc123" };

  it("opens the exact item at Hollywood", () => {
    const url = orderTargetUrl(byId("hollywood"), "item-sheet", item);
    expect(url).toContain("5539-sunset-boulevard");
    expect(url).toContain("/The%20Slider/abc123");
    expect(url).toContain("utm_campaign=item-sheet");
  });

  it("opens Van Nuys' own ordering page, never Hollywood's", () => {
    const url = orderTargetUrl(byId("vannuys"), "item-sheet", item);
    expect(url).toContain("14523-sherman-way");
    expect(url).not.toContain("5539");
    expect(url).toContain("fulfillment_mode=pickup&utm_source=site");
  });
});
