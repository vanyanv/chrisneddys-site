import { describe, expect, it } from "vitest";

import { productLd, shopListLd, productImage } from "@/lib/merchLd";
import { merch } from "@/data/merch";
import { brand } from "@/data/brand";
import { ID } from "@/lib/seo";
import { productSocialImage } from "@/lib/productSeo";

// A real product from the catalogue, not an invented fixture.
const trucker = merch.find((p) => p.slug === "foam-trucker-blue");
if (!trucker) throw new Error("expected foam-trucker-blue in the merch catalogue");

describe("productLd", () => {
  const ld = productLd(trucker, undefined, false);

  it("declares a Product with an absolute, product-scoped @id and url", () => {
    expect(ld["@type"]).toBe("Product");
    expect(ld["@id"]).toBe(`${brand.siteUrl}/shop/foam-trucker-blue/#product`);
    expect(ld.url).toBe(`${brand.siteUrl}/shop/foam-trucker-blue/`);
    expect(ld.url.startsWith("https://")).toBe(true);
  });

  it("carries the required name, description and manufacturer fields", () => {
    // The receipt-grade `name`, not the display lines: those are written in
    // caps for the page's Bowlby heading — see `productMetadataName`.
    expect(ld.name).toBe(trucker.name);
    // The product's own sentence, not the search snippet: a schema
    // `description` has no snippet budget to fit.
    expect(ld.description).toBe(trucker.description);
    expect(ld.manufacturer).toEqual({ "@id": ID.org });
    expect(ld.brand).toEqual({ "@type": "Brand", name: brand.name });
  });

  it("names the product from its display lines when `name` is blank, the way a Rack-created product is", () => {
    const blankName = {
      ...trucker,
      name: "",
      displayName: ["THE FOAM", "TRUCKER"] as [string, string],
    };
    const ld = productLd(blankName);
    expect(ld.name).toBe("THE FOAM TRUCKER");
  });

  it("falls back to a derived description when both the description and the snippet column are empty", () => {
    const blankDescription = { ...trucker, description: "", metaDescription: "" };
    const ld = productLd(blankDescription);
    expect(ld.description.length).toBeGreaterThan(0);
    expect(ld.description).toContain(trucker.name);
  });

  it("nests an Offer with a matching @id, price and no availability while the shop is closed", () => {
    expect(ld.offers["@type"]).toBe("Offer");
    expect(ld.offers["@id"]).toBe(`${ld.url}#offer`);
    expect(ld.offers.price).toBe(trucker.price.toFixed(2));
    expect(ld.offers.priceCurrency).toBe("USD");
    // shopOpen: false was passed in, so no availability is claimed.
    expect(ld.offers.availability).toBeUndefined();
  });

  it("states no availability for untracked inventory while the shop is closed", () => {
    const untracked = productLd(
      trucker,
      { tracked: false, available: 0, editionSize: null },
      false,
    );
    expect(untracked.offers.availability).toBeUndefined();
  });

  it("still says nothing while tracked stock remains and the shop is closed", () => {
    const inStock = productLd(trucker, { tracked: true, available: 13, editionSize: 50 }, false);
    expect(inStock.offers.availability).toBeUndefined();
  });

  it("states SoldOut once tracked inventory hits zero, regardless of shop-open state", () => {
    const soldOutClosed = productLd(
      trucker,
      { tracked: true, available: 0, editionSize: 50 },
      false,
    );
    expect(soldOutClosed.offers.availability).toBe("https://schema.org/SoldOut");

    const soldOutOpen = productLd(trucker, { tracked: true, available: 0, editionSize: 50 }, true);
    expect(soldOutOpen.offers.availability).toBe("https://schema.org/SoldOut");
  });

  it("defaults shopOpen to false when the third argument is omitted", () => {
    const defaulted = productLd(trucker);
    expect(defaulted.offers.availability).toBeUndefined();
  });

  it("states InStock for untracked inventory once the shop is open", () => {
    const untracked = productLd(trucker, { tracked: false, available: 0, editionSize: null }, true);
    expect(untracked.offers.availability).toBe("https://schema.org/InStock");
  });

  it("states InStock for tracked inventory with stock left once the shop is open", () => {
    const inStock = productLd(trucker, { tracked: true, available: 13, editionSize: 50 }, true);
    expect(inStock.offers.availability).toBe("https://schema.org/InStock");
  });
});

describe("shopListLd", () => {
  it("builds an ItemList that points at each product's own page, in order", () => {
    const ld = shopListLd(merch);
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.numberOfItems).toBe(merch.length);
    expect(ld.itemListElement).toHaveLength(merch.length);
    ld.itemListElement.forEach((entry, i) => {
      expect(entry.position).toBe(i + 1);
      expect(entry.name).toBe(merch[i]?.name);
      expect(entry.url).toBe(`${brand.siteUrl}/shop/${merch[i]?.slug}/`);
    });
  });
});

describe("productImage", () => {
  it("leads with the real catalogue product's first view photo, then the owner's own share card", () => {
    const firstPhoto = trucker.views[0]?.photo;
    if (!firstPhoto) throw new Error("expected foam-trucker-blue's first view to have a photo");
    // The seed product has its own `socialImageUrl`, so the card is that file,
    // same as `productSocialImage` returns for it directly.
    expect(productImage(trucker)).toEqual([
      `${brand.siteUrl}${trucker.photoDir}/${firstPhoto.src}.webp`,
      productSocialImage(trucker),
    ]);
  });

  it("leads with the first view's own photo when one exists, then the generated card when there is no owner image", () => {
    const withViewPhoto = {
      slug: "with-view-photo",
      photoDir: "/shop/with-view-photo",
      views: [
        {
          id: "front",
          label: "FRONT",
          caption: "c",
          photo: { src: "front", width: 720, height: 480 },
        },
      ],
    };
    expect(productImage(withViewPhoto)).toEqual([
      `${brand.siteUrl}/shop/with-view-photo/front.webp`,
      `${brand.siteUrl}/shop/with-view-photo/social-card/`,
    ]);
  });

  it("falls back to the legacy Otter photo when there is no view photo", () => {
    const legacy = { slug: "legacy", photo: "abc123" };
    const images = productImage(legacy);
    expect(images[0]).toBe(`${brand.siteUrl}/menu/${legacy.photo}.webp`);
    expect(images[1]).toBe(`${brand.siteUrl}/shop/legacy/social-card/`);
  });

  it("falls back to only the share card when there is no photo at all, using the owner's image when one is set", () => {
    expect(productImage({ slug: "no-photo" })).toEqual([
      `${brand.siteUrl}/shop/no-photo/social-card/`,
    ]);
    expect(
      productImage({ slug: "no-photo", socialImageUrl: "/shop/no-photo/hand-made.png" }),
    ).toEqual([`${brand.siteUrl}/shop/no-photo/hand-made.png`]);
  });
});
