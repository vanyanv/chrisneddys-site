import { describe, expect, it } from "vitest";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";
import { brand } from "@/data/brand";

describe("breadcrumbLd", () => {
  it("puts Home first and preserves the given trail's order", () => {
    const ld = breadcrumbLd([
      { name: "Shop", path: "/shop/" },
      { name: "Ball-Cap", path: "/shop/ball-cap/" },
    ]);

    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement.map((s) => s.name)).toEqual(["Home", "Shop", "Ball-Cap"]);
    expect(ld.itemListElement.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("builds absolute urls from the site origin for every step", () => {
    const ld = breadcrumbLd([{ name: "Menu", path: "/menu/" }]);
    for (const step of ld.itemListElement) {
      expect(step.item.startsWith(brand.siteUrl)).toBe(true);
    }
    expect(ld.itemListElement[0]?.item).toBe(`${brand.siteUrl}/`);
    expect(ld.itemListElement[1]?.item).toBe(`${brand.siteUrl}/menu/`);
  });
});

describe("openGraphFor / twitterFor", () => {
  it("carries the given title, description and path, plus the shared OG image", () => {
    const og = openGraphFor({ title: "T", description: "D", path: "/menu/" });
    expect(og.title).toBe("T");
    expect(og.description).toBe("D");
    expect(og.url).toBe("/menu/");
    expect(og.type).toBe("website");
    expect(og.images).toHaveLength(1);
    expect(og.images[0]?.url).toBe("/og.jpg");
  });

  it("builds a summary_large_image twitter card from the same title and description", () => {
    const tw = twitterFor({ title: "T", description: "D" });
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBe("T");
    expect(tw.images).toEqual(["/og.jpg"]);
  });
});

describe("ID", () => {
  it("exposes stable, absolute @ids for the shared graph nodes", () => {
    expect(ID.org).toBe(`${brand.siteUrl}/#org`);
    expect(ID.website).toBe(`${brand.siteUrl}/#website`);
    expect(ID.menu).toBe(`${brand.siteUrl}/menu/#menu`);
  });
});
