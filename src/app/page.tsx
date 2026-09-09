import { Hero } from "@/components/counter/Hero";
import { Marquee } from "@/components/counter/Marquee";
import { FeaturedCards } from "@/components/counter/FeaturedCards";
import { HollywoodCard } from "@/components/counter/HollywoodCard";
import { LocationsMapCanvas } from "@/components/locations/LocationsMapCanvas";

/** Verbatim, sourced pulls — see the commit that replaced the invented ones. */
const PRESS = [
  {
    quote:
      "The Brendan Fraser of the LA smashburger scene — it might have been a minute since you’ve heard their name, but they clearly can still bring it.",
    cite: "— THE INFATUATION · 7.6/10",
  },
  {
    quote:
      "Co-owned by Poghosyan and his childhood friend, Chris Karimian, who’ve known each other since they were about 13 years old.",
    cite: "— NBC LOS ANGELES · FEB 2026",
  },
  {
    quote:
      "Two juicy $6 doubles will fill you up unless you’re a professional bodybuilder.",
    cite: "— THE INFATUATION",
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

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />

      <section className="cne-sec is-band cne-rv">
        <div className="cne-sec-hd">
          <div>
            <div className="cne-eyebrow">★ One tap to order</div>
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
        <div className="cne-split-r" aria-hidden="true">
          <LocationsMapCanvas />
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-sec-hd">
          <div>
            <div className="cne-eyebrow">What they’re saying</div>
            <h2>Press.</h2>
          </div>
        </div>
        <div className="cne-pressrow">
          {PRESS.map((p) => (
            <blockquote className="cne-quote" key={p.cite + p.quote.slice(0, 12)}>
              <p>{p.quote}</p>
              <cite>{p.cite}</cite>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-sec-hd">
          <div>
            <div className="cne-eyebrow">From the gram</div>
            <h2>@chrisneddys</h2>
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
