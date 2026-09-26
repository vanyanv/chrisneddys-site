import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/shop-index.css";
import "@/styles/shop-inventory.css";
import "@/styles/shop-art.css";
import { brand } from "@/data/brand";
import { TERMS_PENDING, firstView } from "@/data/merch";
import { inventoryLine, listInventory, listPublishedProducts } from "@/lib/catalog";
import { getPublicStoreSettings } from "@/lib/orders";
import { CLOSED_BUTTON_LABEL, editionFlag, shippingReturnsNote } from "@/lib/shopCopy";
import { isShopOpenFor, isShopPausedFor } from "@/lib/shopStatus";
import { formatPrice } from "@/lib/otter";
import { SleepingBadge } from "@/components/storeart/SleepingBadge";
import { ProductShot } from "@/components/shop/ProductShot";
import { ShopIndexTracking } from "@/components/shop/ShopIndexTracking";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { shopListLd } from "@/lib/merchLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";
import { productMetadataName } from "@/lib/productSeo";
import type { MerchProduct } from "@/data/merch";
import { GlyphRow, OpStamp } from "@/components/storeart/SectionOpener";

// No single location: this lede fronts every shop snippet, and there is more than one.
const LEDE = `Merch from ${brand.name}, the Los Angeles smash-burger restaurant.`;

/**
 * The shop index's title and description, read from the published catalogue
 * rather than typed once and left behind: the line used to name "The Foam
 * Trucker — Blue, $48" no matter what was actually for sale, which is exactly
 * wrong the day a second product ships or the first one sells out for good.
 */
function shopIndexMetadata(products: MerchProduct[]): { title: string; description: string } {
  if (products.length === 0) {
    return {
      title: "Shop — Chris N Eddy's Merch",
      description: `${LEDE} Nothing in the shop right now — check back soon.`,
    };
  }
  if (products.length === 1) {
    const p = products[0]!;
    // Not the all-caps display pair the product page's own Bowlby heading
    // uses — see `productMetadataName`'s comment on why metadata wants the
    // other order. The parenthetical (the drop's own colour/capsule note) is
    // dropped the same way a product's own title does: it costs characters
    // this line doesn't have to spend.
    const name = productMetadataName(p).replace(/\s*\(.*\)\s*$/, "");
    // The layout's title template already ends in the brand name, so a
    // product name that starts with it would say it twice.
    const bare = name.startsWith(`${brand.name} `) ? name.slice(brand.name.length + 1) : name;
    return {
      title: `Shop — ${bare}`,
      description: `${LEDE} ${name}, ${formatPrice(p.price)}. One drop, while it lasts.`,
    };
  }
  return {
    title: "Shop — Chris N Eddy's Merch",
    description: `${LEDE} ${products.length} drops in the shop right now.`,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const products = await listPublishedProducts();
  const { title, description } = shopIndexMetadata(products);
  const keywords = Array.from(
    new Set([brand.name, "merch", ...products.map((p) => productMetadataName(p))]),
  );
  return pageMetadata({ title, description, path: "/shop/", keywords });
}

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
  // The settings read depends on nothing else here, so it goes out with the
  // product list rather than after it; the inventory read is the only one
  // that genuinely has to wait, since it needs the slugs. Two hops, not three.
  const [merch, settings] = await Promise.all([listPublishedProducts(), getPublicStoreSettings()]);
  const { description } = shopIndexMetadata(merch);
  const inventories = await listInventory(merch.map((product) => product.slug));
  const note = shippingReturnsNote(settings);
  // Same "only true once the shop has actually opened" rule the product
  // page follows (issue #43) — pre-launch has its own, unrelated "still
  // being sorted" copy below, and never this one.
  const shopOpen = isShopOpenFor(settings);
  const paused = shopOpen && isShopPausedFor(settings);

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
      <section className="cne-sec cne-op-glyph">
        <GlyphRow />
        <div className="cne-eyebrow">Merch</div>
        <h1>The shop.</h1>
        <p className="cne-shop-lede">Small runs. When they’re gone they’re gone.</p>

        <ShopIndexTracking products={merch}>
          {merch.map((product, i) => {
            const line = inventoryLine(inventories[i], product.eyebrow);
            const flag = editionFlag(inventories[i]?.editionSize ?? null);

            return (
              <Link
                prefetch={false}
                key={product.slug}
                href={`/shop/${product.slug}/`}
                className="cne-drop"
                data-slug={product.slug}
              >
                <span className="cne-drop-flag">{line?.soldOut ? "SOLD OUT" : flag}</span>
                <div className="cne-drop-art">
                  {/* A sold-out capsule gets the sleeping badge (idea 11);
                      one still available gets no corner mark. */}
                  {line?.soldOut && <SleepingBadge size={26} />}
                  <ProductShot
                    product={product}
                    view={firstView(product)}
                    sizes="(min-width: 901px) 700px, 100vw"
                    priority
                    cropToFrame
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
                  <p>
                    {product.oneSize ? "One size fits most. " : ""}
                    {product.limitedNote}
                  </p>
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
                    ) : !shopOpen ? (
                      CLOSED_BUTTON_LABEL
                    ) : (
                      <>
                        {inventories[i]?.editionSize != null ? "SECURE YOUR NUMBER" : "GET ONE"}{" "}
                        <span aria-hidden="true">→</span>
                      </>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </ShopIndexTracking>

        {merch.length === 1 && (
          <p className="cne-drop-note">
            <span aria-hidden="true" /> One thing for sale right now. That’s the point.
          </p>
        )}
      </section>

      <section className="cne-sec cne-rv cne-op-stamp">
        <div className="cne-eyebrow">Before you buy</div>
        {note ? (
          <>
            <h2>
              Shipping &amp; returns.
              <OpStamp kind="checker" size={44} />
            </h2>
            <p className="cne-shop-lede">
              {note.line} See{" "}
              <Link prefetch={false} href="/returns/">
                returns
              </Link>
              {note.hasTerms && (
                <>
                  {" "}
                  and{" "}
                  <Link prefetch={false} href="/terms/">
                    terms
                  </Link>
                </>
              )}
              .
            </p>
          </>
        ) : (
          <>
            <h2>
              Still being sorted.
              <OpStamp kind="checker" size={44} />
            </h2>
            <p className="cne-shop-lede">
              {TERMS_PENDING} Want to know when it opens?{" "}
              <Link prefetch={false} href="/contact/">
                Get in touch
              </Link>{" "}
              or call {brand.phone}.
            </p>
          </>
        )}
      </section>
    </>
  );
}
