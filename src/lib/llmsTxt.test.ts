import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "@/lib/llmsTxt";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { allItems, isFoodItem } from "@/data/menu";
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

  it("keeps undated locations private and publishes only confirmed launch facts", () => {
    for (const loc of notOpen.filter((location) => !location.openingAnnouncement)) {
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

    const announced = notOpen.find((location) => location.openingAnnouncement)!;
    expect(text).toContain(announced.openingAnnouncement!);
    expect(text).toContain(announced.address);
    expect(text).toContain(announced.phone!);

    const start = text.indexOf(`### ${announced.name}`);
    const rest = text.slice(start + 1);
    const nextHeadingOffset = rest.search(/\n#{2,3} /);
    const section = nextHeadingOffset === -1 ? rest : rest.slice(0, nextHeadingOffset);
    expect(section).not.toContain("10 AM");
    expect(section).not.toContain("1 AM");
    expect(section).not.toContain("2 AM");
  });

  it("lists every food menu item with its price", () => {
    for (const item of allItems.filter(isFoodItem)) {
      expect(text).toContain(item.name);
      expect(text).toContain(formatPrice(item.price));
    }
  });

  it("never lists the Ball-Cap — it's merch, not food", () => {
    const ballCap = allItems.find((i) => i.id === "chris-n-eddy-s-ball-cap-limited-run");
    expect(ballCap).toBeDefined();
    expect(text).not.toContain(ballCap!.name);
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
