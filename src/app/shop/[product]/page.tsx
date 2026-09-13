import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/data/brand";
import { TERMS_PENDING, merch, productBySlug } from "@/data/merch";
import { formatPrice } from "@/lib/otter";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { BuyProvider, BuyRow, StickyBuy } from "@/components/shop/ProductBuy";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { productLd, socialCard } from "@/lib/merchLd";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

type Params = { product: string };

/** One product today, and the route already handles the second one. */
export function generateStaticParams(): Params[] {
  return merch.map((p) => ({ product: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { product: slug } = await params;
  const product = productBySlug(slug);
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
  const product = productBySlug(slug);
  if (!product) notFound();

  return (
    <>
      <JsonLdScript data={productLd(product)} />
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
              "only 50 made",
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

      <BuyProvider product={product}>
        <nav className="cne-pdp-crumb" aria-label="Breadcrumb">
          <Link href="/shop/">SHOP</Link> <span aria-hidden="true">/</span>{" "}
          <span aria-current="page">{product.displayName.join(" ")}</span>
        </nav>

        <div className="cne-pdp">
          <ProductGallery product={product} />

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

            {/* One size fits most, so there is no variant grid at all. The
                scarcity line takes the space the size chips would have used. */}
            <div className="cne-limited">
              <span className="tag">ONLY 50 MADE</span>
              <span className="txt">{product.limitedNote}</span>
            </div>

            <div className="cne-pdp-lab">
              <span>Size — one size fits most</span>
            </div>
            <span className="cne-chip is-static">ONE SIZE FITS MOST</span>

            <BuyRow />

            <p className="cne-pending">{TERMS_PENDING}</p>
          </div>
        </div>

        <StickyBuy />
      </BuyProvider>

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
                <img
                  className="cne-auth-img is-cert"
                  src={`${product.photoDir}/${product.authenticity.certificate.src}.webp`}
                  srcSet={`${product.photoDir}/${product.authenticity.certificate.src}-thumb.webp 200w, ${product.photoDir}/${product.authenticity.certificate.src}.webp 720w`}
                  sizes="(min-width: 901px) 280px, 45vw"
                  width={product.authenticity.certificate.width}
                  height={product.authenticity.certificate.height}
                  style={{
                    aspectRatio: `${product.authenticity.certificate.width} / ${product.authenticity.certificate.height}`,
                  }}
                  alt={product.authenticity.certificate.alt}
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="cne-auth-img is-sticker"
                  src={`${product.photoDir}/${product.authenticity.sticker.src}.webp`}
                  srcSet={`${product.photoDir}/${product.authenticity.sticker.src}-thumb.webp 200w, ${product.photoDir}/${product.authenticity.sticker.src}.webp 720w`}
                  sizes="(min-width: 901px) 280px, 45vw"
                  width={product.authenticity.sticker.width}
                  height={product.authenticity.sticker.height}
                  style={{
                    aspectRatio: `${product.authenticity.sticker.width} / ${product.authenticity.sticker.height}`,
                  }}
                  alt={product.authenticity.sticker.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
          </div>
        </section>
      )}

      <section className="cne-sec cne-rv cne-pdp-more">
        <div className="cne-eyebrow">While you’re here</div>
        <h2>Come eat.</h2>
        <p>
          The Foam Trucker is from 5539 W. Sunset Blvd — smashed sliders, two patties, two slices of
          cheese, every topping free. <Link href="/menu/">See the menu</Link> or{" "}
          <Link href="/order/">order for pickup</Link>. Questions about the drop go to{" "}
          <Link href="/contact/">the contact page</Link>, or call {brand.phone}.
        </p>
      </section>
    </>
  );
}
