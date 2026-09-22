import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "@/lib/llmsTxt";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { allItems } from "@/data/menu";
import { formatPrice } from "@/lib/otter";
import { merch, type MerchProduct } from "@/data/merch";

const flagship = locations.find((l) => l.id === "hollywood")!;
const notOpen = locations.filter((l) => !l.isOpen);

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt(merch);

  it("states the open location's address, phone and hours", () => {
    expect(text).toContain(flagship.address);
    expect(text).toContain(flagship.phone!);
    // The hours prose is derived from `openingSpec` by `hoursSentence` —
    // asserting the closing time appears is enough to know it's really there.
    expect(text).toMatch(/1 AM|2 AM/);
  });

  it("never states a phone number or hours for a location that hasn't opened", () => {
    for (const loc of notOpen) {
      expect(loc.phone).toBeUndefined();
      // The section for this location is everything between its own heading
      // and the next `###`/`##` heading.
      const start = text.indexOf(`### ${loc.name}`);
      expect(start).toBeGreaterThan(-1);
      const rest = text.slice(start + 1);
      const nextHeadingOffset = rest.search(/\n#{2,3} /);
      const section = nextHeadingOffset === -1 ? rest : rest.slice(0, nextHeadingOffset);
      expect(section).not.toContain(brand.phone);
      expect(section).not.toMatch(/\d{1,2}(:\d{2})?\s?(AM|PM)/);
      expect(section.toLowerCase()).not.toContain("address");
    }
  });

  it("lists every menu item with its price", () => {
    for (const item of allItems) {
      expect(text).toContain(item.name);
      expect(text).toContain(formatPrice(item.price));
    }
  });

  it("lists every published merch product with its price and page link", () => {
    for (const p of merch) {
      expect(text).toContain(p.name);
      expect(text).toContain(formatPrice(p.price));
      expect(text).toContain(`${brand.siteUrl}/shop/${p.slug}/`);
    }
  });

  it("renders sensibly with no published merch products", () => {
    const empty: MerchProduct[] = [];
    const withoutMerch = buildLlmsTxt(empty);
    expect(withoutMerch).toContain("Nothing in the shop right now");
  });

  it("links every internal page absolutely, with a trailing slash", () => {
    const internalLinks = [...text.matchAll(/https:\/\/www\.chrisneddys\.com\/[^\s)]*/g)].map(
      (m) => m[0],
    );
    expect(internalLinks.length).toBeGreaterThan(0);
    for (const link of internalLinks) {
      expect(link.startsWith(brand.siteUrl)).toBe(true);
      const path = link.slice(brand.siteUrl.length);
      const isFile = /\.[a-z0-9]+$/i.test(path);
      if (!isFile) {
        expect(link.endsWith("/")).toBe(true);
      }
    }
  });

  it("never uses the word Counter", () => {
    expect(text.toLowerCase()).not.toContain("counter");
  });

  it("starts with the brand name as an H1 and a one-paragraph summary", () => {
    expect(text.startsWith(`# ${brand.name}`)).toBe(true);
    expect(text).toContain(`\n> `);
  });

  it("ends with an Optional section carrying the sitemap link", () => {
    expect(text).toContain("## Optional");
    expect(text).toContain(`${brand.siteUrl}/sitemap.xml`);
  });
});
