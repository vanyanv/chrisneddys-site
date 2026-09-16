import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/data/brand";
import { MAX_PER_ORDER, TERMS_PENDING } from "@/data/merch";
import {
  getInventory,
  getProductBySlug,
  inventoryLine,
  listPublishedProducts,
} from "@/lib/catalog";
import { getStoreSettings } from "@/lib/orders";
import { editionFlag, pauseNotice, shippingReturnsNote } from "@/lib/shopCopy";
import { isShopOpenFor, isShopPausedFor } from "@/lib/shopStatus";
import { formatPrice } from "@/lib/otter";
import { EditionMap } from "@/components/shop/EditionMap";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { BuyProvider, BuyRow, StickyBuy } from "@/components/shop/ProductBuy";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { productLd, socialCard } from "@/lib/merchLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

type Params = { product: string };

/** Re-checked at most once a minute; `revalidateTag("catalogue")` (phase 2's
 * admin) invalidates it immediately regardless of this window. */
export const revalidate = 60;

/** One product today, and the route already handles the second one. */
export async function generateStaticParams(): Promise<Params[]> {
  const products = await listPublishedProducts();
  return products.map((p) => ({ product: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { product: slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  // Title case, from the product's real name rather than the all-caps display
  // pair — a SERP title in block capitals reads as shouting. The parenthetical
  // is what the page says in its own "limited run" line, so the title spends
  // its 60 characters on the name and the price.
  const title = `${product.name.replace(/\s*\(.*\)\s*$/, "")} — ${formatPrice(product.price)}`;
  const description = product.metaDescription;
  const path = `/shop/${product.slug}/`;

  // Not the shared burger card — a product page shared into a group chat
  // should show the product.
  return pageMetadata({
    title,
    description,
    path,
    image: {
      url: socialCard(product.slug),
      width: 1200,
      height: 630,
      alt: `${product.name} — ${formatPrice(product.price)}`,
    },
  });
}

/**
 * The product page.
 *
 * Everything on it is server-rendered except the gallery and the buy controls,
 * which is what keeps a $48 hat from costing a phone a hydration pass over the
 * whole page. `BuyProvider` is the client boundary; the copy between its tags
 * is passed through as children and never becomes client JS.
 *
 * Below the buy grid are the sections a spec sheet actually supports: the
 * construction details, the fit note, the limited-to-50 explanation, the "why
 * this one" line, and the authenticity section pairing the cap with its
 * certificate. Every one of them reads from `merch.ts`, and every field it
 * reads was confirmed on that sheet — nothing here is padded out with a
 * fabric weight or a shipping promise nobody has agreed to. `TERMS_PENDING`
 * still says out loud what has not been settled.
 */
export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { product: slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const inventory = await getInventory(slug);
  const line = inventoryLine(inventory, product.eyebrow);
  const soldOut = line?.soldOut ?? false;
  const perOrderLimit = product.perOrderLimit ?? MAX_PER_ORDER;
  const maxQty = inventory?.tracked ? Math.min(perOrderLimit, inventory.available) : perOrderLimit;
  const settings = await getStoreSettings();
  const note = shippingReturnsNote(settings);
  const flag = editionFlag(inventory?.editionSize ?? null);
  const shopOpen = isShopOpenFor(settings);
  // Only meaningful once the shop is actually open — a pre-launch shop
  // can't also be "paused", and the two states never mix on the page: the
  // `!shopOpen` notice below is pre-launch's own copy, untouched, and this
  // is the second, separate one (see `isShopPausedFor`'s note).
  const paused = shopOpen && isShopPausedFor(settings);
  const pauseCopy = paused ? pauseNotice(settings.pauseNote) : null;

  return (
    <>
      <JsonLdScript data={productLd(product, inventory, shopOpen)} />
      <JsonLdScript
        data={breadcrumbLd([
          { name: "Shop", path: "/shop/" },
          { name: product.displayName.join(" "), path: `/shop/${product.slug}/` },
        ])}
      />

      {/* Only things that are true about the product go past on the reel. */}
      <div className="cne-mq" aria-hidden="true">
        <div className="cne-mq-track">
          {[...Array(2)].flatMap((_, pass) =>
            [
              "capsule 01",
              "★",
              flag.toLowerCase(),
              "★",
              "numbered /50",
              "★",
              "one size fits most",
              "★",
              formatPrice(product.price),
              "★",
            ].map((word, i) => <span key={`${pass}-${i}`}>{word}</span>),
          )}
        </div>
      </div>

      <BuyProvider
        product={product}
        soldOut={soldOut}
        paused={paused}
        pauseNote={settings.pauseNote}
        maxQty={maxQty}
      >
        <nav className="cne-pdp-crumb" aria-label="Breadcrumb">
          <Link href="/shop/">SHOP</Link> <span aria-hidden="true">/</span>{" "}
          <span aria-current="page">{product.displayName.join(" ")}</span>
        </nav>

        <div className="cne-pdp">
          <ProductGallery product={product} soldOut={soldOut} />

          <div className="cne-pdp-buy">
            <div className="cne-eyebrow">{product.eyebrow}</div>
            {/* The break is the design; the space is so the two lines extract
                as two words and not as "THE FOAM TRUCKER— BLUE". */}
            <h1>
              {product.displayName[0]} <br />
              {product.displayName[1]}
            </h1>

            <div className="cne-pdp-price">
              <span className="cne-price p">{formatPrice(product.price)}</span>
            </div>

            {/* The edition map is the centrepiece for a numbered run: every
                cell is a real row from `editions`, coloured by its own
                status, so "11 of 50 left" is something a buyer can check
                against the number on their certificate rather than take on
                faith. A tracked product with no edition rows (plain
                quantity) falls back to the plain text/bar line instead. */}
            {inventory?.editions ? (
              <EditionMap editions={inventory.editions} />
            ) : (
              line && (
                <div className={`cne-inv${line.soldOut ? " is-soldout" : ""}`}>
                  <span className="cne-inv-text">{line.text}</span>
                  {line.barRatio !== null && (
                    <div className="cne-inv-bar" aria-hidden="true">
                      <span style={{ width: `${line.barRatio * 100}%` }} />
                    </div>
                  )}
                </div>
              )
            )}

            {/* Pre-launch's own notice, unchanged — the shop has simply
                never opened, and adding to the bag is still allowed while
                it isn't. Mutually exclusive with the pause banner below:
                `paused` is only ever true once `shopOpen` already is. */}
            {!shopOpen && (
              <p className="cne-shopnotice">
                The shop isn&rsquo;t taking orders yet. Add this to your bag anyway: it stays saved
                on this device until checkout opens.
              </p>
            )}

            {/* The pause state (issue #43): the owner has shut the counter
                for a few days from `/admin/settings`, on a shop that was
                already open. Everything above — the photo, the price, the
                edition map — stays exactly as it is; only this pill, this
                card, and the buy button below (`BuyProvider`'s `paused`
                prop) change. */}
            {paused && pauseCopy && (
              <>
                <span className="cne-status-pill is-paused">
                  <i aria-hidden="true" />
                  Shop paused
                </span>
                <div className="cne-pause-card">
                  <p className="cne-pause-head">{pauseCopy.heading}</p>
                  <p className="cne-pause-body">{pauseCopy.body}</p>
                </div>
              </>
            )}

            {/* One size fits most, so there is no variant grid at all. The
                scarcity line takes the space the size chips would have used. */}
            <div className="cne-limited">
              <span className="tag">{flag}</span>
              <span className="txt">{product.limitedNote}</span>
            </div>

            <div className="cne-pdp-lab">
              <span>Size — one size fits most</span>
            </div>
            <span className="cne-chip is-static">ONE SIZE FITS MOST</span>

            <BuyRow />

            {note ? (
              <p className="cne-pending">
                {note.line} See <Link href="/returns/">returns</Link>
                {note.hasTerms && (
                  <>
                    {" "}
                    and <Link href="/terms/">terms</Link>
                  </>
                )}
                .
              </p>
            ) : (
              <p className="cne-pending">{TERMS_PENDING}</p>
            )}
          </div>
        </div>

        {product.details && product.details.length > 0 && (
          <section className="cne-sec cne-rv cne-pdp-details">
            <div className="cne-eyebrow">The details</div>
            <h2>What&rsquo;s actually on it.</h2>
            <ul className="cne-detail-list">
              {product.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            {product.fit && (
              <div className="cne-detail-block">
                <div className="cne-pdp-lab">Fit</div>
                <p>{product.fit}</p>
              </div>
            )}

            {product.limitedCopy && (
              <div className="cne-detail-block">
                <div className="cne-pdp-lab">Limited to 50</div>
                <p>{product.limitedCopy}</p>
              </div>
            )}

            {product.why && (
              <div className="cne-detail-block">
                <div className="cne-pdp-lab">Why this one</div>
                <p>{product.why}</p>
              </div>
            )}
          </section>
        )}

        {product.authenticityCopy && (
          <section className="cne-sec cne-rv cne-pdp-auth">
            <div className="cne-eyebrow">Authenticity</div>
            <h2>Paired with the cap.</h2>
            <div className="cne-auth">
              <div className="cne-auth-copy">
                <p>{product.authenticityCopy}</p>
                {product.authenticityFacts && product.authenticityFacts.length > 0 && (
                  <dl className="cne-auth-facts">
                    {product.authenticityFacts.map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              {product.authenticity && (
                <div className="cne-auth-imgs">
                  {(() => {
                    const cert = product.authenticity.certificate;
                    const certFull = cert.url ?? `${product.photoDir}/${cert.src}.webp`;
                    const certThumb = cert.thumbUrl ?? `${product.photoDir}/${cert.src}-thumb.webp`;
                    return (
                      <img
                        className="cne-auth-img is-cert"
                        src={certFull}
                        srcSet={`${certThumb} 200w, ${certFull} 720w`}
                        sizes="(min-width: 901px) 280px, 45vw"
                        width={cert.width}
                        height={cert.height}
                        style={{ aspectRatio: `${cert.width} / ${cert.height}` }}
                        alt={cert.alt}
                        loading="lazy"
                        decoding="async"
                      />
                    );
                  })()}
                  {(() => {
                    const sticker = product.authenticity.sticker;
                    const stickerFull = sticker.url ?? `${product.photoDir}/${sticker.src}.webp`;
                    const stickerThumb =
                      sticker.thumbUrl ?? `${product.photoDir}/${sticker.src}-thumb.webp`;
                    return (
                      <img
                        className="cne-auth-img is-sticker"
                        src={stickerFull}
                        srcSet={`${stickerThumb} 200w, ${stickerFull} 720w`}
                        sizes="(min-width: 901px) 280px, 45vw"
                        width={sticker.width}
                        height={sticker.height}
                        style={{ aspectRatio: `${sticker.width} / ${sticker.height}` }}
                        alt={sticker.alt}
                        loading="lazy"
                        decoding="async"
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="cne-sec cne-rv cne-pdp-more">
          <div className="cne-eyebrow">While you’re here</div>
          <h2>Come eat.</h2>
          <p>
            The Foam Trucker is from 5539 W. Sunset Blvd — smashed sliders, two patties, two slices
            of cheese, every topping free. <Link href="/menu/">See the menu</Link> or{" "}
            <Link href="/order/">order for pickup</Link>. Questions about the drop go to{" "}
            <Link href="/contact/">the contact page</Link>, or call {brand.phone}.
          </p>
        </section>

        <StickyBuy />
      </BuyProvider>
    </>
  );
}
