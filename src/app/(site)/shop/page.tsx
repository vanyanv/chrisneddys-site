import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/brand";
import { TERMS_PENDING, firstView } from "@/data/merch";
import { getInventory, inventoryLine, listPublishedProducts } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/orders";
import { editionFlag, shippingReturnsNote } from "@/lib/shopCopy";
import { isShopOpenFor, isShopPausedFor } from "@/lib/shopStatus";
import { formatPrice } from "@/lib/otter";
import { ProductShot } from "@/components/shop/ProductShot";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { shopListLd } from "@/lib/merchLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";

const title = "Shop — Chris N Eddy's Merch";
const description =
  "Merch from Chris N Eddy's, the smash-burger location on Sunset in Hollywood. The Foam Trucker — Blue, $48, Capsule 01, only 50 made.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/shop/" });

/** Re-checked at most once a minute; `revalidateTag("catalogue")` (phase 2's
 * admin) invalidates it immediately regardless of this window. */
export const revalidate = 60;

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
export default async function ShopPage() {
  const merch = await listPublishedProducts();
  const inventories = await Promise.all(merch.map((product) => getInventory(product.slug)));
  const settings = await getStoreSettings();
  const note = shippingReturnsNote(settings);
  // Same "only true once the shop has actually opened" rule the product
  // page follows (issue #43) — pre-launch has its own, unrelated "still
  // being sorted" copy below, and never this one.
  const paused = isShopOpenFor(settings) && isShopPausedFor(settings);

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
          {merch.map((product, i) => {
            const line = inventoryLine(inventories[i], product.eyebrow);
            const flag = editionFlag(inventories[i]?.editionSize ?? null);

            return (
              <Link key={product.slug} href={`/shop/${product.slug}/`} className="cne-drop">
                <span className="cne-drop-flag">{line?.soldOut ? "SOLD OUT" : flag}</span>
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
                  <div className="cne-drop-price">{formatPrice(product.price)}</div>
                  {line && (
                    <div className={`cne-inv is-sm${line.soldOut ? " is-soldout" : ""}`}>
                      <span className="cne-inv-text">{line.text}</span>
                      {line.barRatio !== null && (
                        <div className="cne-inv-bar" aria-hidden="true">
                          <span style={{ width: `${line.barRatio * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                  <p>One size fits most. {product.limitedNote}</p>
                  {/* The index card's own "buy button": the whole card is a
                      link to the product page (which stays reachable either
                      way), so only this line's words change while paused —
                      sold-out first, since a run that's actually gone stays
                      "SOLD OUT" rather than the temporary paused label. */}
                  <span className="cne-drop-go">
                    {line?.soldOut ? (
                      "SOLD OUT"
                    ) : paused ? (
                      "SHOP PAUSED"
                    ) : (
                      <>
                        SECURE YOUR NUMBER <span aria-hidden="true">→</span>
                      </>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="cne-drop-note">
          <span aria-hidden="true" /> One thing for sale right now. That’s the point.
        </p>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Before you buy</div>
        {note ? (
          <>
            <h2>Shipping &amp; returns.</h2>
            <p className="cne-shop-lede">
              {note.line} See <Link href="/returns/">returns</Link>
              {note.hasTerms && (
                <>
                  {" "}
                  and <Link href="/terms/">terms</Link>
                </>
              )}
              .
            </p>
          </>
        ) : (
          <>
            <h2>Still being sorted.</h2>
            <p className="cne-shop-lede">
              {TERMS_PENDING} Want to know when it opens? <Link href="/contact/">Get in touch</Link>{" "}
              or call {brand.phone}.
            </p>
          </>
        )}
      </section>
    </>
  );
}
