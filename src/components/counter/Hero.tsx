import Link from "next/link";
import { formatPrice } from "@/lib/otter";
import { SLIDER_PRICE } from "@/data/menu";
import { HERO, HERO_WIDE } from "@/lib/heroImage";
import { Watcher } from "@/components/storeart/Watcher";
import { HeroOpenLine } from "@/components/counter/HeroOpenLine";
import { HeroOrderButton } from "@/components/counter/HeroOrderButton";

/**
 * "3A The Peek" (issue #112): a red copy panel and an edge-to-edge basket
 * shot, split by a checkerboard seam borrowed from the store floor, with the
 * corner monster peeking over the boundary between them. On a phone the
 * photo stacks above the panel; from 600px up they sit side by side, panel
 * left and photo right — see `.cne-hero-in` in counter.css for the shape at
 * each tier.
 */
export function Hero() {
  return (
    <section className="cne-hero">
      <div className="cne-hero-in">
        <div className="cne-hero-copy">
          <div className="cne-hero-copy-in">
            <HeroOpenLine />
            <h1>
              LA&rsquo;S <span className="y">SMASH</span>
              <br className="cne-br-desk" /> HIT.
            </h1>
            <p className="cne-hero-sub">
              Sliders come with <b>two All-American smashed patties</b>,{" "}
              <b>two slices of melted cheese</b> and your favorite toppings served on a buttered
              Martin&rsquo;s Potato Roll.
            </p>
            {/* The figure comes from the menu data rather than the copy: it and the /menu/
                meta description had already drifted a dollar apart. */}
            <p className="cne-hero-meta">
              Sliders from <b>{formatPrice(SLIDER_PRICE)}</b>
            </p>
            <div className="cne-cta" data-surface="hero">
              <HeroOrderButton />
              <Link prefetch={false} className="cne-hero-menu" href="/menu/">
                <span className="cne-only-desk-i">SEE THE&nbsp;</span>MENU
              </Link>
            </div>
          </div>
        </div>
        {/* aria-hidden checkerboard divider between the panel and the photo —
            see `.cne-hero-seam` in counter.css. */}
        <div className="cne-hero-seam" aria-hidden="true" />
        <div className="cne-heromedia">
          {/* The loop this replaces was decoration, so it was loaded conditionally and
              never counted as the LCP. A still *is* the LCP: it ships eagerly, at high
              priority. It is deliberately not preloaded; `page.tsx` says why.

              The box is landscape (100vw x 76vw) on a phone, but the source is a
              portrait 1400x1480 shot — a `cover` fit there would download the full
              portrait width just to keep a band out of the middle. Below 600px the
              two extra sources hand phones an art-directed landscape crop instead
              (`HERO_WIDE`, cut from the middle of the same still by
              `build-photo-cuts.mjs`); at 600px and up the box runs the full hero
              height in its own half-width column, closer to the source's own
              proportions, so the portrait cut (`HERO`) stays the better fit there. */}
          <picture>
            <source
              media="(max-width: 599px)"
              type="image/avif"
              srcSet={HERO_WIDE.avifSrcSet}
              sizes={HERO_WIDE.sizes}
            />
            <source
              media="(max-width: 599px)"
              type="image/webp"
              srcSet={HERO_WIDE.webpSrcSet}
              sizes={HERO_WIDE.sizes}
            />
            <source type="image/avif" srcSet={HERO.avifSrcSet} sizes={HERO.sizes} />
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
          </picture>
        </div>
      </div>
      {/* Idea 2: its eye tracks the pointer on fine-pointer devices. Peeking over the
          seam instead of sitting in the usual `.cne-badge-corner` spot — see
          `.cne-hero-peek` in counter.css and the removed hero rule in home-art.css. */}
      <Watcher className="cne-hero-peek" />
    </section>
  );
}
