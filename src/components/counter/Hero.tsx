import { storeUrl } from "@/lib/otter";
import { HeroMedia } from "@/components/home/HeroMedia";

/**
 * Red panel, oversized display type, and the signature slider on video.
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
            Sliders come with two All-American smashed patties, two slices of melted cheese
            and your favorite toppings served on a buttered Martin&rsquo;s Potato Roll.
            Sliders from <b>$7.49</b>.
          </p>
          <div className="cne-cta">
            <a
              className="cne-big is-primary"
              href={storeUrl}
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
          <HeroMedia />
          <div className="cne-stamp" aria-hidden="true">
            SIGNATURE
            <br />
            SLIDER
          </div>
        </div>
      </div>
    </section>
  );
}
