import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/styles/shop-product.css";
import "@/styles/shop-inventory.css";
import { brand } from "@/data/brand";
import { MAX_PER_ORDER, TERMS_PENDING } from "@/data/merch";
import {
  getProductBySlug,
  inventoryLine,
  listInventory,
  listPublishedProducts,
} from "@/lib/catalog";
import { getPublicStoreSettings } from "@/lib/orders";
import { editionFlag, pauseNotice, shippingReturnsNote } from "@/lib/shopCopy";
import { isShopOpenFor, isShopPausedFor } from "@/lib/shopStatus";
import { formatPrice } from "@/lib/otter";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { BuyProvider, BuyRow, StickyBuy } from "@/components/shop/ProductBuy";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { productLd } from "@/lib/merchLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { resolveProductSeo } from "@/lib/productSeo";

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

  const seo = resolveProductSeo(product);
  const path = `/shop/${product.slug}/`;

  // Not the shared burger card — a product page shared into a group chat
  // should show the product.
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path,
    keywords: seo.keywords,
    image: {
      url: seo.imageUrl,
      width: 1200,
      height: 630,
      alt: seo.imageAlt,
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
 * construction details, the fit note, the limited-run explanation, the "why
 * this one" line, and the authenticity section pairing the cap with its
 * certificate. Every one of them reads from `merch.ts`, and every field it
 * reads was confirmed on that sheet — nothing here is padded out with a
 * fabric weight or a shipping promise nobody has agreed to. `TERMS_PENDING`
 * still says out loud what has not been settled.
 *
 * Nothing on the page states a run size, a capsule or a size of its own:
 * each of those comes from the product and its inventory as the owner set
 * them in /admin, so changing the edition size there changes every place
 * the page says it.
 */
export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { product: slug } = await params;
  // All three reads key off the slug alone, so none of them has to wait on
  // another — one hop for the page instead of three. A slug that turns out
  // not to exist pays for two reads it doesn't use, which is a 404 nobody is
  // waiting on, not the path that matters.
  const [product, inventory, settings] = await Promise.all([
    getProductBySlug(slug),
    // The counts-only read: the page shows "N of M left", not the edition
    // rows themselves, so it doesn't need to load every numbered row.
    listInventory([slug]).then(([inventory]) => inventory),
    getPublicStoreSettings(),
  ]);
  if (!product) notFound();

  const line = inventoryLine(inventory, product.eyebrow);
  const soldOut = line?.soldOut ?? false;
  const perOrderLimit = product.perOrderLimit ?? MAX_PER_ORDER;
  const maxQty = inventory?.tracked ? Math.min(perOrderLimit, inventory.available) : perOrderLimit;
  const note = shippingReturnsNote(settings);
  const editionSize = inventory?.editionSize ?? null;
  const flag = editionFlag(editionSize);
  // The reel's words, every one of them read from the product: its capsule
  // label (the eyebrow's last part, e.g. "Capsule 01"), the run size, the
  // fit, the price.
  const capsule = product.eyebrow.match(/capsule\s+\S+/i)?.[0];
  const reel = [
    capsule?.toLowerCase(),
    flag.toLowerCase(),
    editionSize !== null ? `numbered /${editionSize}` : null,
    product.oneSize ? "one size fits most" : null,
    formatPrice(product.price),
  ].filter((word): word is string => Boolean(word));
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
            reel
              .flatMap((word) => [word, "★"])
              .map((word, i) => <span key={`${pass}-${i}`}>{word}</span>),
          )}
        </div>
      </div>

      <BuyProvider
        product={product}
        soldOut={soldOut}
        paused={paused}
        closed={!shopOpen}
        pauseNote={settings.pauseNote}
        maxQty={maxQty}
      >
        <nav className="cne-pdp-crumb" aria-label="Breadcrumb">
          <Link prefetch={false} href="/shop/">
            SHOP
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
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

            {/* "N of M left" and its bar, from the live inventory — the same
                line the shop index card shows. Nothing when the run isn't
                tracked (see `inventoryLine`). */}
            {line && (
              <div className={`cne-inv${line.soldOut ? " is-soldout" : ""}`}>
                <span className="cne-inv-text">{line.text}</span>
                {line.barRatio !== null && (
                  <div className="cne-inv-bar" aria-hidden="true">
                    <span style={{ width: `${line.barRatio * 100}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* Pre-launch's own notice — the shop has simply never opened.
                It no longer invites an add to the bag: a page that says
                checkout isn't open beside a live ADD TO BAG button read as
                a contradiction, so the buy button is disabled below
                (`BuyProvider`'s `closed` prop) until it is. Mutually exclusive with the pause banner below:
                `paused` is only ever true once `shopOpen` already is. */}
            {!shopOpen && <p className="cne-shopnotice">The shop isn&rsquo;t taking orders yet.</p>}

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

            {/* There are no size variants, so there is no size picker. The
                scarcity line takes the space the size chips would have used. */}
            <div className="cne-limited">
              <span className="tag">{flag}</span>
              <span className="txt">{product.limitedNote}</span>
            </div>

            <div className="cne-pdp-lab">
              <span>{product.oneSize ? "Size — one size fits most" : "Per order"}</span>
            </div>
            <div className="cne-pdp-chips">
              {product.oneSize && <span className="cne-chip is-static">ONE SIZE FITS MOST</span>}
              {/* States the real per-order cap enforced on the stepper below
                  (`perOrderLimit`, falling back to `MAX_PER_ORDER`) rather
                  than leaving it undiscoverable until someone hits it. */}
              <span className="cne-chip is-static">LIMIT {perOrderLimit}</span>
            </div>

            <BuyRow />

            {note ? (
              <p className="cne-pending">
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
                <div className="cne-pdp-lab">
                  {editionSize !== null ? `Limited to ${editionSize}` : "Limited run"}
                </div>
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
                    // Same three cuts as the gallery (see `ProductShot`): the
                    // 400px file only exists for in-repo photography, so an
                    // uploaded image keeps the original pair.
                    const certSrcSet =
                      cert.url || cert.thumbUrl
                        ? `${certThumb} 200w, ${certFull} 720w`
                        : `${certThumb} 200w, ${product.photoDir}/${cert.src}-mid.webp 400w, ${certFull} 720w`;
                    return (
                      <img
                        className="cne-auth-img is-cert"
                        src={certFull}
                        srcSet={certSrcSet}
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
                    const stickerSrcSet =
                      sticker.url || sticker.thumbUrl
                        ? `${stickerThumb} 200w, ${stickerFull} 720w`
                        : `${stickerThumb} 200w, ${product.photoDir}/${sticker.src}-mid.webp 400w, ${stickerFull} 720w`;
                    return (
                      <img
                        className="cne-auth-img is-sticker"
                        src={stickerFull}
                        srcSet={stickerSrcSet}
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
            Every drop comes out of 5539 W. Sunset Blvd — smashed sliders, two patties, two slices
            of cheese, every topping free.{" "}
            <Link prefetch={false} href="/menu/">
              See the menu
            </Link>{" "}
            or{" "}
            <Link prefetch={false} href="/order/">
              order for pickup
            </Link>
            . Questions about the drop go to{" "}
            <Link prefetch={false} href="/contact/">
              the contact page
            </Link>
            , or call {brand.phone}.
          </p>
        </section>

        <StickyBuy />
      </BuyProvider>
    </>
  );
}
