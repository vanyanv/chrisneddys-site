/**
 * `/llms.txt` — the plain-English page an AI answer engine reads instead of
 * (or before) crawling the whole site. Convention: https://llmstxt.org/ —
 * an `# H1`, a `> ` one-paragraph summary, then `##` sections of links and
 * facts.
 *
 * Built here as a pure function of the site's own data, exactly the facts
 * `JsonLd.tsx` already derives (see `restaurantNode` in
 * `src/components/shared/JsonLd.tsx`), so it can never say something the
 * structured data doesn't also say: a location gets a phone number, hours
 * and an order link only once `loc.isOpen` is true, and never before. This
 * file does no I/O — it takes the published merch catalogue as an argument
 * (`src/app/llms.txt/route.ts` reads it through `src/lib/catalog.ts`, the
 * same way `src/app/sitemap.ts` does) so it stays trivial to unit test.
 *
 * Never invents a fact, a rating or a price. Never uses the word "Counter" —
 * the brand voice avoids it, and an AI answer engine that quotes this file
 * verbatim would otherwise put that word in someone's mouth.
 */
import { brand } from "@/data/brand";
import { locations, type Location } from "@/data/locations";
import { menu, categoryTitles, type MenuCategoryKey } from "@/data/menu";
import { sharedFaq } from "@/data/faq";
import { deliveryPlatforms, cateringPlatform } from "@/data/delivery";
import { hoursSentence } from "@/lib/hours";
import { slugFor } from "@/lib/locationSlug";
import { storeUrl, formatPrice } from "@/lib/otter";
import type { MerchProduct } from "@/data/merch";

/** `path` starting with "/" -> the full `https://www.chrisneddys.com/...` link. */
function siteUrl(path: string): string {
  return `${brand.siteUrl}${path}`;
}

function locationPageUrl(loc: Location): string {
  return siteUrl(`/locations/${slugFor(loc)}/`);
}

/**
 * One location's section. Open locations state address, phone, hours and how
 * to order there — the same facts and the same gate `restaurantNode` uses.
 * A location that has not opened gets its status and its page link only:
 * no phone, no hours, no order link, because none of those exist yet.
 */
function locationSection(loc: Location): string {
  const heading = `### ${loc.name}`;
  const pageLine = `- Page: ${locationPageUrl(loc)}`;

  if (!loc.isOpen) {
    return [heading, "Status: opening soon.", pageLine].join("\n");
  }

  const lines = [
    heading,
    "Status: open now.",
    `- Address: ${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`.trim(),
  ];
  if (loc.phone) lines.push(`- Phone: ${loc.phone}`);
  const hours = hoursSentence(loc);
  if (hours) lines.push(`- Hours: ${hours}`);
  if (loc.otter) lines.push(`- Order online: ${storeUrl}`);
  lines.push(pageLine);
  return lines.join("\n");
}

function locationsSection(): string {
  return ["## Locations", ...locations.map(locationSection)].join("\n\n");
}

function orderingSection(): string {
  const openLocations = locations.filter((l) => l.isOpen);
  const lines = [
    "## How To Order",
    `Order direct on our own storefront for pickup — it's the cheaper way to buy, since the delivery apps set their own prices and add their own fees: ${storeUrl}`,
    `Every online order runs through the Hollywood location today${
      openLocations.length === 1 ? "" : " — the other locations have not opened yet"
    }.`,
    `Delivery: ${deliveryPlatforms.map((p) => `${p.name} (${p.url})`).join(", ")}.`,
    `Catering: ${cateringPlatform.name} (${cateringPlatform.url}).`,
    `Order page: ${siteUrl("/order/")}`,
  ];
  return lines.join("\n");
}

function menuSection(): string {
  const sections = (Object.keys(menu) as MenuCategoryKey[]).map((key) => {
    const items = menu[key].map(
      (item) => `- ${item.name} — ${formatPrice(item.price)}${item.desc ? ` — ${item.desc}` : ""}`,
    );
    return [`### ${categoryTitles[key]}`, ...items].join("\n");
  });
  return ["## Menu", `Full menu: ${siteUrl("/menu/")}`, ...sections].join("\n\n");
}

function shopSection(products: MerchProduct[]): string {
  const lines = ["## Shop", `Merch shop: ${siteUrl("/shop/")}`];
  if (products.length === 0) {
    lines.push("Nothing in the shop right now — check back soon.");
  } else {
    for (const p of products) {
      lines.push(`- ${p.name} — ${formatPrice(p.price)} — ${siteUrl(`/shop/${p.slug}/`)}`);
    }
  }
  return lines.join("\n");
}

function faqSection(): string {
  const entries = sharedFaq.map((entry) => `### ${entry.q}\n${entry.a}`);
  return ["## FAQ", ...entries].join("\n\n");
}

/** Key pages plus the sitemap, per the llms.txt convention's closing section. */
function optionalSection(): string {
  const links = [
    ["Home", siteUrl("/")],
    ["Menu", siteUrl("/menu/")],
    ["Order", siteUrl("/order/")],
    ["Locations", siteUrl("/locations/")],
    ["Shop", siteUrl("/shop/")],
    ["About", siteUrl("/about/")],
    ["Contact", siteUrl("/contact/")],
    ["Careers", siteUrl("/careers/")],
    ["Sitemap", siteUrl("/sitemap.xml")],
  ] as const;
  return ["## Optional", ...links.map(([label, url]) => `- [${label}](${url})`)].join("\n");
}

/**
 * The whole page. `products` is the published merch catalogue — pass
 * `await listPublishedProducts()` (`src/lib/catalog.ts`) from the route.
 */
export function buildLlmsTxt(products: MerchProduct[]): string {
  const summary =
    `${brand.name} is a smash-burger location on Sunset Blvd in Hollywood, Los Angeles ` +
    `(${brand.tagline}). The signature order is the slider: two smashed patties, two ` +
    `slices of cheese, a buttered Martin's roll, every topping free. Order pickup direct ` +
    `on the storefront, or delivery through DoorDash, Uber Eats or Grubhub. Glendale and ` +
    `Van Nuys locations are opening soon.`;

  return [
    `# ${brand.name}`,
    `> ${summary}`,
    locationsSection(),
    orderingSection(),
    menuSection(),
    shopSection(products),
    faqSection(),
    optionalSection(),
  ].join("\n\n");
}
