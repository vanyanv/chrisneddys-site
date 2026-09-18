import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_LIMIT,
  TITLE_LIMIT,
  draftStoredSeo,
  parseKeywords,
  productSocialImage,
  resolveProductSeo,
  type ProductSeoInput,
} from "@/lib/productSeo";
import { brand } from "@/data/brand";

/** What The Rack's "New product" button leaves behind: a slug and not much else. */
const bare: ProductSeoInput = { slug: "cne-tee", displayName1: "CNE", displayName2: "Tee" };

/** A product an owner has actually filled in, none of its SEO columns written. */
const filled: ProductSeoInput = {
  slug: "foam-trucker-blue",
  name: "The Foam Trucker (Blue)",
  price: 48,
  eyebrow: "CNE Merch Capsule 01",
  description: "A five-panel foam trucker in Sunset blue, embroidered front and back.",
  metaDescription: "",
  limitedNote: "Only 50 made. Individually numbered /50.",
};

describe("resolveProductSeo", () => {
  it("gives a product with nothing written a title, a snippet and alt text", () => {
    const seo = resolveProductSeo(bare);
    expect(seo.title).toBe("CNE Tee");
    expect(seo.description).toContain("CNE Tee");
    expect(seo.imageAlt).toContain("CNE Tee");
    expect(seo.keywords.length).toBeGreaterThan(0);
  });

  it("leads the title and the snippet with the name and the price", () => {
    const seo = resolveProductSeo(filled);
    expect(seo.title).toBe("The Foam Trucker — $48.00");
    expect(seo.description.startsWith("The Foam Trucker (Blue), $48.00.")).toBe(true);
    expect(seo.description).toContain("Only 50 made");
  });

  it("prefers what the owner wrote over anything derived", () => {
    const seo = resolveProductSeo({
      ...filled,
      metaTitle: "Foam Trucker, Sunset Blue",
      metaDescription: "The blue one. 50 made, numbered, no restock.",
      metaKeywords: "foam trucker, cne merch, hollywood hat",
      socialImageAlt: "A blue foam trucker cap on a butcher-paper background",
    });
    expect(seo.title).toBe("Foam Trucker, Sunset Blue");
    expect(seo.description).toBe("The blue one. 50 made, numbered, no restock.");
    expect(seo.keywords).toEqual(["foam trucker", "cne merch", "hollywood hat"]);
    expect(seo.imageAlt).toBe("A blue foam trucker cap on a butcher-paper background");
  });

  it("keeps the lines it composes itself inside the budgets Google renders, cutting on a word", () => {
    const seo = resolveProductSeo({
      ...filled,
      displayName1: "The Foam Trucker in Sunset Blue with 3D puff embroidery front and back",
      displayName2: "",
      name: "",
      description: "A five-panel foam trucker in Sunset blue. ".repeat(12),
    });
    expect(seo.title.length).toBeLessThanOrEqual(TITLE_LIMIT);
    expect(seo.description.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
    expect(seo.title.endsWith(" ")).toBe(false);
    expect(seo.description.endsWith(" ")).toBe(false);
    // Cut between words, not through one.
    expect(seo.description.endsWith("blu")).toBe(false);
  });

  it("passes an owner's own words through untouched, even past the budget", () => {
    // The seeded product's hand-written snippet is 159 characters. Trimming it
    // to 155 costs the last clause and gains nothing: Google truncates a
    // snippet for display without penalising the page, and the admin already
    // refuses anything over the budget on the way in.
    const long = "x".repeat(200);
    const seo = resolveProductSeo({ ...filled, metaTitle: long, metaDescription: long });
    expect(seo.title).toBe(long);
    expect(seo.description).toBe(long);
  });

  it("reads a storefront product's two-line display name as well as the admin's", () => {
    const seo = resolveProductSeo({ slug: "cne-tee", displayName: ["CNE", "Tee"] });
    expect(seo.title).toBe("CNE Tee");
  });
});

describe("productSocialImage", () => {
  it("points at the generated card, not a PNG nobody has made", () => {
    expect(productSocialImage(bare)).toBe(`${brand.siteUrl}/shop/cne-tee/social-card/`);
  });

  it("uses an owner's own image, absolute or root-relative", () => {
    expect(productSocialImage({ ...bare, socialImageUrl: "/shop/foam-trucker-blue.png" })).toBe(
      `${brand.siteUrl}/shop/foam-trucker-blue.png`,
    );
    expect(productSocialImage({ ...bare, socialImageUrl: "https://cdn.example/card.png" })).toBe(
      "https://cdn.example/card.png",
    );
  });
});

describe("parseKeywords", () => {
  it("splits, trims and drops repeats and blanks", () => {
    expect(parseKeywords(" foam trucker , , CNE merch, foam trucker ")).toEqual([
      "foam trucker",
      "CNE merch",
    ]);
  });

  it("reads nothing out of nothing", () => {
    expect(parseKeywords(null)).toEqual([]);
    expect(parseKeywords("  ")).toEqual([]);
  });
});

describe("draftStoredSeo", () => {
  it("hands back four non-empty fields inside their budgets", () => {
    const drafted = draftStoredSeo(filled);
    expect(drafted.metaTitle.length).toBeGreaterThan(0);
    expect(drafted.metaTitle.length).toBeLessThanOrEqual(TITLE_LIMIT);
    expect(drafted.metaDescription.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
    expect(drafted.metaKeywords).toContain("CNE Merch Capsule 01");
    expect(drafted.socialImageAlt.length).toBeGreaterThan(0);
  });

  it("never invents a name for a product that has none", () => {
    const drafted = draftStoredSeo({ slug: "untitled" });
    expect(drafted.metaKeywords).not.toContain("Untitled product");
  });
});
