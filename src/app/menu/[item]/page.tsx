import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { featuredItems, itemById, ways, toppings, extras } from "@/data/menu";
import { itemOrderUrl, itemPhotoAlt, formatPrice } from "@/lib/otter";
import { googleDirections } from "@/lib/directions";
import { JsonLdScript, flagshipRestaurantLd } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";

type Params = { params: Promise<{ item: string }> };

/**
 * A page for the handful of items people search by name.
 *
 * Everything used to live on one /menu/ page, and the only per-item link left
 * the domain for Otter — so a search for "chris n eddy's quad" had nowhere on
 * this site to land. These pages give the six most-asked-about items a URL,
 * a photograph, a price and a direct add-to-cart link.
 *
 * Deliberately not all 31 items: the rest would be thin, near-identical pages
 * competing with each other and with /menu/. See `featuredItemIds`.
 */
export function generateStaticParams() {
  return featuredItems.map((i) => ({ item: i.id }));
}

/**
 * Google prints about 155 characters of a description and cuts the rest
 * mid-word. The tail below is fixed, so the item's own line gets whatever is
 * left and is trimmed back to a word boundary if it does not fit — a cut this
 * page makes on purpose reads better than one the SERP makes for it.
 */
const DESC_LIMIT = 155;

function clampToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "")}…`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { item: slug } = await params;
  const item = itemById(slug);
  if (!item) return {};

  const title = `${item.name} — ${formatPrice(item.price)}`;
  const full = `${title} · ${brand.name}`;
  const tail = `${formatPrice(
    item.price,
  )}, pickup on Sunset Blvd, Hollywood. Every topping free.`;
  const description = `${clampToWord(item.desc, DESC_LIMIT - tail.length - 1)} ${tail}`;

  return {
    title,
    description,
    alternates: { canonical: `/menu/${item.id}/` },
    openGraph: openGraphFor({ title: full, description, path: `/menu/${item.id}/` }),
    twitter: twitterFor({ title: full, description }),
  };
}

export default async function MenuItemPage({ params }: Params) {
  const { item: slug } = await params;
  const item = itemById(slug);
  if (!item) notFound();

  const hollywood = locations.find((l) => l.id === "hollywood");
  const orderHref = itemOrderUrl(item, "menu-item");

  /**
   * A `MenuItem` rather than a `Product`: this is a dish on a restaurant's
   * menu, and it is tied back to the Menu node the /menu/ page owns rather
   * than declaring a second, competing description of the same thing.
   */
  const itemLd = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "@id": `${brand.siteUrl}/menu/${item.id}/#item`,
    name: item.name,
    description: item.desc,
    url: `${brand.siteUrl}/menu/${item.id}/`,
    ...(item.photo ? { image: `${brand.siteUrl}/menu/${item.photo}.webp` } : {}),
    offers: {
      "@type": "Offer",
      price: item.price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: itemOrderUrl(item),
      availableAtOrFrom: { "@id": `${brand.siteUrl}/locations/hollywood/#restaurant` },
    },
    isPartOf: { "@id": ID.menu },
  };

  return (
    <>
      <JsonLdScript
        data={breadcrumbLd([
          { name: "Menu", path: "/menu/" },
          { name: item.name, path: `/menu/${item.id}/` },
        ])}
      />
      <JsonLdScript data={itemLd} />
      {/* The Offer above references the Hollywood Restaurant node by @id; this
          page is not otherwise about a store, so the node has to be emitted
          here too or the reference resolves to nothing. */}
      <JsonLdScript data={flagshipRestaurantLd()} />

      <nav className="cne-sec" aria-label="Breadcrumb" style={{ paddingBottom: 0 }}>
        <div className="cne-eyebrow">
          <Link href="/menu/" style={{ color: "inherit" }}>
            Menu
          </Link>{" "}
          / {item.name}
        </div>
      </nav>

      <section className="cne-sec cne-rv">
        <h1>{item.name}</h1>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            margin: "6px 0 0",
            color: "var(--a-red)",
          }}
        >
          {formatPrice(item.price)}
        </p>
        <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
          {item.desc}
        </p>

        {item.photo && (
          <div
            style={{
              marginTop: 16,
              maxWidth: 520,
              border: "3px solid #1a1612",
              boxShadow: "6px 6px 0 #1a1612",
              overflow: "hidden",
            }}
          >
            <img
              src={`/menu/${item.photo}.webp`}
              srcSet={`/menu/${item.photo}-thumb.webp 200w, /menu/${item.photo}.webp 720w`}
              sizes="(min-width: 901px) 520px, calc(100vw - 36px)"
              alt={itemPhotoAlt(item)}
              width={720}
              height={479}
              decoding="async"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </div>
        )}

        <div className="cne-loc-btns" style={{ marginTop: 18 }} data-surface="menu-item">
          <a
            className="cne-mini is-red"
            href={orderHref}
            data-item={item.id}
            target="_blank"
            rel="noopener noreferrer"
          >
            ADD ON OTTER · {formatPrice(item.price)}
          </a>
          <a className="cne-mini is-plain" href={`tel:${brand.phoneTel}`}>
            CALL {brand.phone}
          </a>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Opens this exact item on our ordering page, ready to add.
        </p>
      </section>

      {item.takesToppings && (
        <section className="cne-sec cne-rv">
          <div className="cne-eyebrow">Free either way</div>
          <h2>Pick a way.</h2>
          <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, color: "var(--a-sub)" }}>
            Every topping is free. Order it one of the two house ways, or build it yourself
            from the same list — the price on this page does not change either way.
          </p>
          <div className="cne-loc-hrs" style={{ marginTop: 12, maxWidth: "42ch" }}>
            {ways.map((w) => (
              <div className="r" key={w.id}>
                <span>{w.name.toUpperCase()}</span>
                <b>{w.summary}</b>
              </div>
            ))}
          </div>
          <p style={{ maxWidth: "62ch", fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
            All free: {toppings.map((t) => t.name).join(", ")}. The only paid additions are{" "}
            {extras.map((e) => `${e.name} +${formatPrice(e.price)}`).join(" and ")}.
          </p>
        </section>
      )}

      {hollywood && (
        <section className="cne-sec cne-rv" style={{ paddingBottom: 40 }}>
          <div className="cne-eyebrow">Where to get it</div>
          <h2>Hollywood location.</h2>
          <address className="cne-loc-addr" style={{ fontStyle: "normal", marginTop: 8 }}>
            {hollywood.address}
            <br />
            {hollywood.city}, {hollywood.region} {hollywood.postal}
          </address>
          <div className="cne-loc-hrs" style={{ marginTop: 10, maxWidth: "42ch" }}>
            {hollywood.hours.map(([day, hrs]) => (
              <div className="r" key={day}>
                <span>{day.toUpperCase()}</span>
                <b>{hrs}</b>
              </div>
            ))}
          </div>
          <div className="cne-loc-btns" style={{ marginTop: 14 }} data-surface="menu-item">
            <a
              className="cne-mini is-plain"
              href={googleDirections(hollywood)}
              target="_blank"
              rel="noopener noreferrer"
            >
              DIRECTIONS
            </a>
            <Link className="cne-mini is-plain" href="/menu/">
              THE FULL MENU
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
