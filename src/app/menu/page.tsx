import type { Metadata } from "next";
import { MenuBrowser } from "@/components/counter/MenuBrowser";
import { JsonLdScript, menuNode } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor } from "@/lib/seo";
import { SLIDER_PRICE, COMBO_FROM_PRICE, featuredItems } from "@/data/menu";
import Link from "next/link";
import { formatPrice as fmt } from "@/lib/otter";
import { formatPrice } from "@/lib/otter";

const title = "Menu & Prices — Sliders, Combos, Fries & Shakes";
/**
 * Built from the menu data, not typed out: the $6.49 this used to promise was
 * the single-patty slider, while the hero quoted $7.49 for the signature one.
 * A snippet that undercuts its own landing page by a dollar is worse than no
 * snippet, so both figures now come from the same place.
 */
const description = `The full Chris N Eddy's menu with live pickup prices: sliders from ${formatPrice(
  SLIDER_PRICE,
)}, combos from ${formatPrice(
  COMBO_FROM_PRICE,
)}, chris-cut fries, shakes and the Secret Menu. Tap any item to order.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/menu/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/menu/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

export default function MenuPage() {
  return (
    <>
      {/* The one page that carries the whole Menu node — every item, every
          price. Elsewhere the Restaurant nodes point at the stub. */}
      <JsonLdScript data={{ "@context": "https://schema.org", ...menuNode() }} />
      <JsonLdScript data={breadcrumbLd([{ name: "Menu", path: "/menu/" }])} />
      <MenuBrowser />

      {/* Crawlable links to the named-item pages. The rows above are buttons
          that open a sheet, so without these the item pages would be in the
          sitemap and linked from nowhere. */}
      <section className="cne-sec cne-rv" style={{ paddingBottom: 40 }}>
        <div className="cne-eyebrow">Asked about most</div>
        <h2>The ones people name.</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", maxWidth: "48ch" }}>
          {featuredItems.map((i) => (
            <li key={i.id} style={{ borderTop: "1px solid var(--a-rule, #e2d8c7)" }}>
              <Link
                href={`/menu/${i.id}/`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "11px 0",
                  color: "inherit",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                <span style={{ fontWeight: 700 }}>{i.name}</span>
                <span style={{ whiteSpace: "nowrap" }}>{fmt(i.price)} &rsaquo;</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
