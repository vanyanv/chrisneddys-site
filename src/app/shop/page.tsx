import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/brand";
import { TERMS_PENDING, merch, money, firstView } from "@/data/merch";
import { ProductShot } from "@/components/shop/ProductShot";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { shopListLd } from "@/lib/merchLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";

const title = "Shop — Chris N Eddy's Merch";
const description =
  "Merch from Chris N Eddy's, the smash-burger location on Sunset in Hollywood. The Ball-Cap, $48, one size fits all, limited quantity.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/shop/" },
  openGraph: openGraphFor({ title: `${title} · ${brand.name}`, description, path: "/shop/" }),
  twitter: twitterFor({ title: `${title} · ${brand.name}`, description }),
};

/**
 * The shop index.
 *
 * There is one product, so this is deliberately not a grid: three columns with
 * one thing in them reads as two that failed to load. It is one wide card, and
 * the line under it says out loud that one drop is the point rather than a
 * shortfall. The day there is a second product this becomes a real grid and the
 * card styles carry over unchanged.
 *
 * The "how it ships" block that used to sit at the bottom is gone. It stated a
 * shipping rate, a free-shipping threshold, a delivery window and a returns
 * window, and not one of the four had been decided.
 */
export default function ShopPage() {
  return (
    <>
      <JsonLdScript data={breadcrumbLd([{ name: "Shop", path: "/shop/" }])} />
      <JsonLdScript data={shopListLd(merch)} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${brand.siteUrl}/shop/#page`,
          url: `${brand.siteUrl}/shop/`,
          name: `${brand.name} Shop`,
          description,
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
        }}
      />

      {/* Not `cne-rv`: this is the top of the page, and a section that starts
          at opacity 0 and fades in is the element the browser then reports as
          LCP. The reveal belongs to what is below the fold. */}
      <section className="cne-sec">
        <div className="cne-eyebrow">Merch</div>
        <h1>The shop.</h1>
        <p className="cne-shop-lede">
          Small runs from 5539 W. Sunset Blvd. When they’re gone they’re gone.
        </p>

        <div className="cne-drops">
          {merch.map((product) => (
            <Link key={product.slug} href={`/shop/${product.slug}/`} className="cne-drop">
              <span className="cne-drop-flag">LIMITED RUN</span>
              <div className="cne-drop-art">
                <ProductShot
                  product={product}
                  view={firstView(product)}
                  sizes="(min-width: 901px) 700px, 100vw"
                  priority
                />
              </div>
              <div className="cne-drop-b">
                <h2>
                  {product.displayName[0]}
                  <br />
                  {product.displayName[1]}
                </h2>
                <div className="cne-drop-price">{money(product.price)}</div>
                <p>One size fits all. {product.limitedNote}</p>
                <span className="cne-drop-go">
                  VIEW THE CAP <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="cne-drop-note">
          <span aria-hidden="true" /> One thing for sale right now. That’s the point.
        </p>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Before you buy</div>
        <h2>Still being sorted.</h2>
        <p className="cne-shop-lede">
          {TERMS_PENDING} Want to know when it opens?{" "}
          <Link href="/contact/">Get in touch</Link> or call {brand.phone}.
        </p>
      </section>
    </>
  );
}
