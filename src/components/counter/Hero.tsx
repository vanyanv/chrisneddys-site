import { orderUrl, formatPrice } from "@/lib/otter";
import { SLIDER_PRICE } from "@/data/menu";
import { HERO } from "@/lib/heroImage";

/**
 * Red panel, oversized display type, and the basket shot.
 * On desktop the red becomes a left-hand panel and the media sits beside it —
 * see `.cne-hero-halftone` at the desktop breakpoint.
 */
export function Hero() {
  return (
    <section className="cne-hero">
      <div className="cne-hero-halftone" aria-hidden="true" />
      <div className="cne-hero-in">
        <div>
          <h1>
            LA&rsquo;S <span className="y">SMASH</span>
            <br className="cne-br-desk" /> HIT.
          </h1>
          <p className="cne-hero-sub">
            Sliders come with <b>two All-American smashed patties</b>,{" "}
            <b>two slices of melted cheese</b> and your favorite toppings served on a buttered
            Martin&rsquo;s Potato Roll.
          </p>
          {/* The price used to be the last four words of the paragraph, which put it as far
              from the order button as the copy allowed. It reads as a fact strip now, one
              line above the button that spends it. Hollywood only: Glendale and Van Nuys
              have no hours in `locations.ts` because they are not serving yet.

              The figure comes from the menu data rather than the copy: it and the /menu/
              meta description had already drifted a dollar apart. */}
          <p className="cne-hero-meta">
            <span>
              Sliders from <b>{formatPrice(SLIDER_PRICE)}</b>
            </span>
            <span className="cne-hero-dot" aria-hidden="true">
              ·
            </span>
            <span>Hollywood</span>
            <span className="cne-hero-dot is-addr" aria-hidden="true">
              ·
            </span>
            <span className="cne-hero-addr">5539 W. Sunset Blvd</span>
          </p>
          <div className="cne-cta" data-surface="hero">
            <a
              className="cne-big is-primary"
              href={orderUrl("hero")}
              target="_blank"
              rel="noopener noreferrer"
            >
              ORDER ONLINE →
            </a>
            <a className="cne-big is-secondary" href="/menu/">
              <span className="cne-only-desk-i">SEE THE&nbsp;</span>MENU
            </a>
          </div>
        </div>
        <div className="cne-heromedia">
          {/* The loop this replaces was decoration, so it was loaded conditionally and
              never counted as the LCP. A still *is* the LCP: it ships eagerly, at high
              priority, and is preloaded from `page.tsx`. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO.src}
            srcSet={HERO.srcSet}
            sizes={HERO.sizes}
            alt={HERO.alt}
            width={HERO.width}
            height={HERO.height}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
