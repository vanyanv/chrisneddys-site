import { ImageResponse } from "next/og";
import { brand } from "@/data/brand";
import { getProductBySlug } from "@/lib/catalog";
import { formatPrice } from "@/lib/otter";
import { customerFacingProductName } from "@/lib/productName";

/**
 * The 1200x630 card a shared product link previews as.
 *
 * `scripts/render-merch-og.mjs` renders the nicer card — the brand's own faces,
 * run by hand and committed as `public/shop/<slug>.png`. That is still the
 * better picture and still wins: a product whose social image field points at a
 * file uses the file. But it only ever existed for the one seeded product,
 * because running a script and committing a PNG is not part of adding a product
 * in the admin, so every product created there pointed `og:image` at a file
 * nobody had made and previewed as a broken box. This route is the floor under
 * that: a card drawn from the row, so a product has a share picture the moment
 * it exists, and one that cannot go stale when its price changes.
 *
 * The script's own comment gives the reason it exists — that a static export
 * writes an `opengraph-image` route to an extensionless file served as
 * octet-stream. That was true of the old build; the site runs a real server now.
 *
 * Why a plain route handler and not Next's `opengraph-image.tsx` convention:
 * that convention appends a generated suffix to the served path
 * (`…/opengraph-image-kgflvv`), and Next only fills the matching `og:image` tag
 * in for you when the page's own metadata does not set `openGraph.images` —
 * which `pageMetadata` always does, deliberately, so a sub-page cannot ship
 * with no social image at all. Four separate things need this URL by name: the
 * Open Graph tag, the Twitter tag, `Product.image` in the structured data, and
 * the sitemap. A hand-written route is the only way all four can name it, so
 * the URL is built in one place, `productSocialImage()`.
 *
 * Deliberately typographic rather than photographic. A product shot letterboxed
 * into 1200x630 is a small object in a wide grey field — the same reasoning
 * `merchLd.ts` records for preferring a card over the photograph.
 *
 * No webfont is loaded. Bowlby and the rest of the brand faces would each be a
 * file fetched per render, and this is a fallback that has to be dependable
 * before it is on-brand; the colours and the layout carry it.
 */

const SIZE = { width: 1200, height: 630 };

/**
 * A card only changes when its product does, and a crawler may ask for it
 * repeatedly while a link circulates. A day in a shared cache with a week of
 * stale-while-revalidate behind it costs nothing and keeps this off the
 * render path.
 */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const INK = "#1a1612";
const PAPER = "#fff8e7";
const RED = "#e63027";
const YELLOW = "#f5b82e";
const MUTED = "#a89d88";

export async function GET(_request: Request, { params }: { params: Promise<{ product: string }> }) {
  const { product: slug } = await params;
  const product = await getProductBySlug(slug);

  const name = product ? customerFacingProductName(product) : brand.name;
  const eyebrow = product?.eyebrow?.trim() || "Merch";
  const price = product && product.price > 0 ? formatPrice(product.price) : null;
  // The same scarcity line the page and the snippet use, so the card cannot
  // promise a run size the product does not have.
  const note = product?.limitedNote?.trim() ?? "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: INK,
        padding: "72px 80px",
        // A wide rule of brand yellow along the top, the way the marquee reads.
        borderTop: `18px solid ${YELLOW}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: YELLOW,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: name.length > 24 ? 92 : 116,
            lineHeight: 1.05,
            color: PAPER,
          }}
        >
          {name}
        </div>
        {note ? <div style={{ display: "flex", fontSize: 34, color: MUTED }}>{note}</div> : null}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: PAPER,
          }}
        >
          {brand.name}
        </div>
        {price ? (
          <div
            style={{
              display: "flex",
              background: RED,
              color: PAPER,
              fontSize: 56,
              padding: "16px 36px",
              borderRadius: 8,
            }}
          >
            {price}
          </div>
        ) : null}
      </div>
    </div>,
    { ...SIZE, headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
