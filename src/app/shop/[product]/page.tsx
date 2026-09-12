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
 * The page is short on purpose. Four things about this cap are known — its
 * name, its price, that the run is limited and that it is one size — and those
 * four things are what it says. The spec table, the highlights, the shipping
 * and returns block and the FAQ that were here have all been removed: every
 * line in them was invented, and a page that pads itself out with invented
 * detail is worse than a short one, because a buyer cannot tell which half to
 * believe. `TERMS_PENDING` says out loud what has not been settled.
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
            ["limited run", "★", "one size fits all", "★", formatPrice(product.price), "★"].map(
              (word, i) => <span key={`${pass}-${i}`}>{word}</span>,
            ),
          )}
        </div>
      </div>

      <BuyProvider product={product}>
        <nav className="cne-pdp-crumb" aria-label="Breadcrumb">
          <Link href="/shop/">SHOP</Link> <span aria-hidden="true">/</span>{" "}
          <span aria-current="page">{product.displayName[1]}</span>
        </nav>

        <div className="cne-pdp">
          <ProductGallery product={product} />

          <div className="cne-pdp-buy">
            <div className="cne-eyebrow">Limited run</div>
            {/* The break is the design; the space is so the two lines extract
                as two words and not as "CHRIS N EDDY’SBALL-CAP". */}
            <h1>
              {product.displayName[0]} <br />
              {product.displayName[1]}
            </h1>

            <div className="cne-pdp-price">
              <span className="cne-price p">{formatPrice(product.price)}</span>
            </div>

            {/* One size fits all, so there is no variant grid at all. The
                scarcity line takes the space the size chips would have used. */}
            <div className="cne-limited">
              <span className="tag">LIMITED RUN</span>
              <span className="txt">{product.limitedNote}</span>
            </div>

            <div className="cne-pdp-lab">
              <span>Size — one size fits all</span>
            </div>
            <span className="cne-chip is-static">ONE SIZE FITS ALL</span>

            <BuyRow />

            <p className="cne-pending">{TERMS_PENDING}</p>
          </div>
        </div>

        <StickyBuy />
      </BuyProvider>

      <section className="cne-sec cne-rv cne-pdp-more">
        <div className="cne-eyebrow">While you’re here</div>
        <h2>Come eat.</h2>
        <p>
          The cap is from 5539 W. Sunset Blvd — smashed sliders, two patties, two slices of cheese,
          every topping free. <Link href="/menu/">See the menu</Link> or{" "}
          <Link href="/order/">order for pickup</Link>. Questions about the drop go to{" "}
          <Link href="/contact/">the contact page</Link>, or call {brand.phone}.
        </p>
      </section>
    </>
  );
}
