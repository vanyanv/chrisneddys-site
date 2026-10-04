import "@/styles/menu-item.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import Link from "next/link";
import { brand } from "@/data/brand";
import { openLocations, openNames } from "@/lib/openLocations";
import { allPhotosFor, featuredItems, itemById, ways, toppings, extras } from "@/data/menu";
import { itemOrderUrl, itemPhotoAlt, formatPrice, priceString } from "@/lib/otter";
import { slugFor } from "@/lib/locationSlug";
import { OpenLocationCards } from "@/components/locations/OpenLocationCards";
import { OrderLink } from "@/components/order/OrderLink";
import { JsonLdScript, restaurantLd } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";
import { clampToWord } from "@/lib/text";
import { MenuPhoto } from "@/components/counter/MenuPhoto";
import { menuPhotoLargest } from "@/lib/menuPhoto";

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

/** Every item page is known at build time. Any other id is a plain 404
 * instead of a fresh render that Vercel would also store in its ISR cache. */
export const dynamicParams = false;

/**
 * Google prints about 155 characters of a description and cuts the rest
 * mid-word. The tail below is fixed, so the item's own line gets whatever is
 * left and is trimmed back to a word boundary if it does not fit — a cut this
 * page makes on purpose reads better than one the SERP makes for it.
 */
const DESC_LIMIT = 155;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { item: slug } = await params;
  const item = itemById(slug);
  if (!item) return {};

  const title = `${item.name} — ${formatPrice(item.price)}`;
  const tail = `${formatPrice(item.price)}, pickup in ${openNames()}.`;
  const description = `${clampToWord(item.desc, DESC_LIMIT - tail.length - 1)} ${tail}`;

  return pageMetadata({ title, description, path: `/menu/${item.id}/` });
}

export default async function MenuItemPage({ params }: Params) {
  const { item: slug } = await params;
  const item = itemById(slug);
  if (!item) notFound();

  const open = openLocations();

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
    ...(item.photo
      ? { image: allPhotosFor(item).map((photo) => `${brand.siteUrl}${menuPhotoLargest(photo)}`) }
      : {}),
    offers: {
      "@type": "Offer",
      price: priceString(item.price),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: itemOrderUrl(item),
      availableAtOrFrom: open.map((loc) => ({
        "@id": `${brand.siteUrl}/locations/${slugFor(loc)}/#restaurant`,
      })),
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
      {/* The Offer above references each open store's Restaurant node by @id;
          this page is not otherwise about a store, so the nodes have to be
          emitted here too or the references resolve to nothing. */}
      {open.map((loc) => (
        <JsonLdScript key={loc.id} data={restaurantLd(loc)} />
      ))}

      <nav className="cne-sec cne-item-crumbs" aria-label="Breadcrumb">
        <div className="cne-eyebrow cne-item-crumb">
          <Link prefetch={false} href="/menu/">
            Menu
          </Link>{" "}
          / <span aria-current="page">{item.name}</span>
        </div>
      </nav>

      <section className="cne-sec cne-rv">
        <div className="cne-item-top">
          <div className="cne-item-head">
            <h1 className="cne-item-name">{item.name}</h1>
            <p className="cne-item-price">{formatPrice(item.price)}</p>
            <p className="cne-item-desc">{item.desc}</p>
          </div>

          {item.photo && (
            <div className="cne-item-photo">
              {/* The page's LCP. Capped at 1080px: a 3x phone draws it about
                  1100 device px wide, and the 1280 cut cost a slow phone
                  connection 0.1 s more for no difference you can see. */}
              <MenuPhoto
                photo={item.photo}
                max={1080}
                sizes="(min-width: 556px) 514px, calc(100vw - 36px)"
                alt={itemPhotoAlt(item)}
                fetchPriority="high"
                decoding="async"
                className="cne-item-photo-img"
              />
            </div>
          )}

          <div className="cne-item-buy">
            <div className="cne-loc-btns" data-surface="menu-item">
              <OrderLink className="cne-mini is-red" surface="menu-item" item={item}>
                ADD TO ORDER · {formatPrice(item.price)}
              </OrderLink>
            </div>
            <p className="cne-item-note">
              {item.takesToppings
                ? "Opens your location's ordering page. Tick your Way's toppings there, all free."
                : "Opens your location's ordering page."}
            </p>
          </div>
        </div>
      </section>

      {item.takesToppings && (
        <section className="cne-sec cne-rv">
          <div className="cne-eyebrow">Free either way</div>
          <h2>Pick a way.</h2>
          <p className="cne-lede">
            Order it one of the two house ways, or build it yourself from the same list — the price
            on this page does not change either way.
          </p>
          <dl className="cne-item-ways">
            {ways.map((w) => (
              <Fragment key={w.id}>
                <dt>{w.name.toUpperCase()}</dt>
                <dd>{w.summary}</dd>
              </Fragment>
            ))}
          </dl>
          <p className="cne-item-free">
            All free: {toppings.map((t) => t.name).join(", ")}. The only paid additions are{" "}
            {extras.map((e) => `${e.name} +${formatPrice(e.price)}`).join(" and ")}.
          </p>
        </section>
      )}

      <section className="cne-sec cne-rv cne-item-where">
        <div className="cne-eyebrow">Where to get it</div>
        <h2>Pick your location.</h2>
        <div className="cne-item-cards">
          <OpenLocationCards surface="menu-item" />
        </div>
        <div className="cne-loc-btns" data-surface="menu-item">
          <Link prefetch={false} className="cne-mini is-plain" href="/menu/">
            THE FULL MENU
          </Link>
        </div>
      </section>
    </>
  );
}
