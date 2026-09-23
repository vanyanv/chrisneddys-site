import type { Metadata } from "next";
import { MenuBrowser } from "@/components/counter/MenuBrowser";
import { JsonLdScript, menuNode, flagshipRestaurantLd } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { SLIDER_PRICE, COMBO_FROM_PRICE, featuredItems } from "@/data/menu";
import Link from "next/link";
import { formatPrice } from "@/lib/otter";
import { ScrollChecker } from "@/components/storeart/ScrollChecker";

const title = "Menu & Prices — Sliders, Combos & Fries";
/**
 * Built from the menu data, not typed out: the $6.49 this used to promise was
 * the single-patty slider, while the hero quoted $7.49 for the signature one.
 * A snippet that undercuts its own landing page by a dollar is worse than no
 * snippet, so both figures now come from the same place.
 */
const description = `The full Chris N Eddy's menu and pickup prices: sliders from ${formatPrice(
  SLIDER_PRICE,
)}, combos from ${formatPrice(
  COMBO_FROM_PRICE,
)}, chris-cut fries, shakes and the Secret Menu. Every topping free.`;

export const metadata: Metadata = pageMetadata({ title, description, path: "/menu/" });

export default function MenuPage() {
  return (
    <>
      {/* Idea 12: checkerboard scroll progress, /menu only. */}
      <ScrollChecker />
      {/* The one page that carries the whole Menu node — every item, every
          price. Elsewhere the Restaurant nodes point at the stub. */}
      <JsonLdScript data={{ "@context": "https://schema.org", ...menuNode() }} />
      <JsonLdScript data={breadcrumbLd([{ name: "Menu", path: "/menu/" }])} />
      {/* The store the menu is served at, so `hasMenu` has both ends on one page. */}
      <JsonLdScript data={flagshipRestaurantLd()} />
      <MenuBrowser />

      {/* Crawlable links to the named-item pages. The rows above are buttons
          that open a sheet, so without these the item pages would be in the
          sitemap and linked from nowhere. Desktop-only: `MenuBrowser` shows
          its own copy of this list near the top of the page on a phone, so
          the most-asked-about items aren't the last thing in the scroll. */}
      <section className="cne-sec cne-rv cne-only-desk" style={{ paddingBottom: 40 }}>
        <div className="cne-eyebrow">Asked about most</div>
        <h2>The ones people name.</h2>
        <ul className="cne-menu-named">
          {featuredItems.map((i) => (
            <li key={i.id}>
              <Link prefetch={false} href={`/menu/${i.id}/`}>
                <span className="n">{i.name}</span>
                <span className="p">{formatPrice(i.price)} &rsaquo;</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
