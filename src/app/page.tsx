import { brand } from "@/data/brand";
import { Hero } from "@/components/counter/Hero";
import { Marquee } from "@/components/counter/Marquee";
import { FeaturedCards } from "@/components/counter/FeaturedCards";
import { HollywoodCard } from "@/components/counter/HollywoodCard";
import { LocationsMapCanvas } from "@/components/locations/LocationsMapCanvas";
import { MapPins } from "@/components/locations/MapPins";
import { MapCallout } from "@/components/locations/MapCallout";
import { JsonLdScript, flagshipRestaurantLd } from "@/components/shared/JsonLd";

/** Verbatim, sourced pulls — see the commit that replaced the invented ones. */
const PRESS = [
  {
    quote:
      "The Brendan Fraser of the LA smashburger scene — it might have been a minute since you’ve heard their name, but they clearly can still bring it.",
    cite: "THE INFATUATION · 7.6/10",
  },
  {
    quote:
      "Co-owned by Poghosyan and his childhood friend, Chris Karimian, who’ve known each other since they were about 13 years old.",
    cite: "NBC LOS ANGELES · FEB 2026",
  },
  {
    quote:
      "Two juicy $6 doubles will fill you up unless you’re a professional bodybuilder.",
    cite: "THE INFATUATION",
  },
];

const GRAM = [
  { src: "/photos/ig-pile.webp", alt: "A pile of Chris N Eddy’s smash sliders against red graffiti neon" },
  { src: "/photos/ig-neon.webp", alt: "Three Chris N Eddy’s sliders in hand with the shop neon glowing behind" },
  { src: "/photos/ig-monster.webp", alt: "Stacked sliders in front of Chris N Eddy’s monster mural" },
  { src: "/photos/ig-pyramid.webp", alt: "Three sliders stacked on wax paper with loaded fries" },
  { src: "/photos/ig-stack.webp", alt: "A towering Chris N Eddy’s smash burger with pickles and sauce" },
  { src: "/photos/double.webp", alt: "The signature Chris N Eddy’s double slider" },
];

/* There used to be a `preload(HERO.src, …)` here, guarded by a comment saying
   "Home only — no other page shows it, and preloading it there would be a
   wasted 30 KB." The guard did not hold. React serialises a Float preload into
   this route's RSC payload, and the header links to `/` from every page, so the
   moment Next prefetched home from anywhere else the directive was hoisted into
   *that* document's head. Measured on /menu/: a 56 KB hero fetch at high
   priority, on a page whose entire transfer was 67 KB, competing with the menu
   thumbnails and never painted. The console said so on every load.

   The hero `<img>` in `Hero.tsx` already ships eagerly with fetchPriority
   ="high", and the preload scanner reads raw markup ahead of the parser rather
   than waiting on the stylesheet, so home keeps its head start and the other
   five pages stop paying for it. */

export default function HomePage() {
  return (
    <>
      {/* The home page is about the Hollywood store — it carries its hours, its
          address and its order buttons — so it is one of the four pages that
          states the Restaurant node. The two locations that have not opened
          state nothing anywhere until they do. */}
      <JsonLdScript data={flagshipRestaurantLd()} />
      <Hero />
      <Marquee />

      <section className="cne-sec is-band cne-rv">
        <div className="cne-sec-hd">
          <div>
            <div className="cne-eyebrow">★ The three we sell most</div>
            <h2>Start here.</h2>
          </div>
          <div className="cne-sec-note">
            Live Hollywood pickup pricing.
            <br />
            Every topping free.
          </div>
        </div>
        <FeaturedCards />
      </section>

      <section className="cne-split">
        <div className="cne-split-l cne-sec cne-rv">
          <div className="cne-eyebrow">Where to find us</div>
          <h2>Where we are.</h2>
          <HollywoodCard />
        </div>
        {/* The pins are what make this read as our map rather than a map of
            LA, so the home page draws the same three the prototype does. It is
            a picture here — /locations owns the interactive version. */}
        <div className="cne-split-r">
          <div style={{ position: "relative", width: "100%" }} aria-hidden="true">
            <LocationsMapCanvas />
            <MapPins />
            <MapCallout />
          </div>
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-sec-hd">
          <div>
            <div className="cne-eyebrow">What they’re saying</div>
            <h2>
              Press<span className="cne-only-desk-i"> &amp; reviews</span>.
            </h2>
          </div>
        </div>
        <div className="cne-pressrow">
          {PRESS.map((p) => (
            <blockquote className="cne-quote" key={p.cite + p.quote.slice(0, 12)}>
              <p>&ldquo;{p.quote}&rdquo;</p>
              <cite>{p.cite}</cite>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-sec-hd">
          <div>
            <div className="cne-eyebrow">From the gram</div>
            {/* The handle is the section's own heading, so the link lives
                inside the h2 rather than around it — the animated rule under
                the heading belongs to the h2 and stays put. */}
            <h2>
              <a
                className="cne-iglink"
                href={brand.igUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {brand.ig}
              </a>
            </h2>
          </div>
        </div>
      </section>
      <div className="cne-ig cne-rv">
        {GRAM.map((g) => (
          <span key={g.src}>
            {/* 3 columns on a phone (~120px), 6 on desktop (~230px) — the
                300px variant covers the phone at 2x, the 500px the desktop. */}
            <img
              src={g.src}
              srcSet={`${g.src.replace(".webp", "-sm.webp")} 300w, ${g.src} 500w`}
              sizes="(min-width: 901px) 230px, 33vw"
              alt={g.alt}
              width={500}
              height={500}
              loading="lazy"
              decoding="async"
            />
          </span>
        ))}
      </div>
    </>
  );
}
