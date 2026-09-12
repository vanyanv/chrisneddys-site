import { describe, expect, it } from "vitest";
import { productLd, shopListLd, socialCard, productImage } from "@/lib/merchLd";
import { merch } from "@/data/merch";
import { brand } from "@/data/brand";
import { ID } from "@/lib/seo";

// A real product from the catalogue, not an invented fixture.
const ballCap = merch.find((p) => p.slug === "ball-cap");
if (!ballCap) throw new Error("expected ball-cap in the merch catalogue");

describe("productLd", () => {
  const ld = productLd(ballCap);

  it("declares a Product with an absolute, product-scoped @id and url", () => {
    expect(ld["@type"]).toBe("Product");
    expect(ld["@id"]).toBe(`${brand.siteUrl}/shop/ball-cap/#product`);
    expect(ld.url).toBe(`${brand.siteUrl}/shop/ball-cap/`);
    expect(ld.url.startsWith("https://")).toBe(true);
  });

  it("carries the required name, description and manufacturer fields", () => {
    expect(ld.name).toBe(ballCap.name);
    expect(ld.description).toBe(ballCap.description);
    expect(ld.manufacturer).toEqual({ "@id": ID.org });
    expect(ld.brand).toEqual({ "@type": "Brand", name: brand.name });
  });

  it("nests an Offer with a matching @id, price and no availability while the shop is closed", () => {
    expect(ld.offers["@type"]).toBe("Offer");
    expect(ld.offers["@id"]).toBe(`${ld.url}#offer`);
    expect(ld.offers.price).toBe(ballCap.price.toFixed(2));
    expect(ld.offers.priceCurrency).toBe("USD");
    // SHOP_OPEN is false in this catalogue, so no availability is claimed.
    expect(ld.offers.availability).toBeUndefined();
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

describe("socialCard / productImage", () => {
  it("builds an absolute social card url from the slug", () => {
    expect(socialCard("ball-cap")).toBe(`${brand.siteUrl}/shop/ball-cap.png`);
  });

  it("leads with the product photo when there is one, then the social card", () => {
    const images = productImage(ballCap);
    expect(images[0]).toBe(`${brand.siteUrl}/menu/${ballCap.photo}.webp`);
    expect(images[1]).toBe(socialCard(ballCap.slug));
  });

  it("falls back to only the social card when there is no photo", () => {
    expect(productImage({ slug: "no-photo" })).toEqual([socialCard("no-photo")]);
  });
});
