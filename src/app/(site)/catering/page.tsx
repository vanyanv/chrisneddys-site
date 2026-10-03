import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/catering.css";
import { brand } from "@/data/brand";
import { allItems, type MenuItem } from "@/data/menu";
import { FEATURED_OTTER_IDS } from "@/data/featured";
import { CATERING_HREF } from "@/data/catering";
import { itemPhotoAlt } from "@/lib/otter";
import { breadcrumbLd, pageMetadata, ID, OG_SPREAD } from "@/lib/seo";
import { ArtPhoto } from "@/components/art/ArtPhoto";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";
import { DripEdge } from "@/components/storeart/DripEdge";
import { GlyphRow } from "@/components/storeart/SectionOpener";
import { MenuPhoto } from "@/components/counter/MenuPhoto";

const title = "Catering — Sliders for Offices & Parties";
const description =
  "Chris N Eddy's catering in Los Angeles: smash burger sliders, a side of fries and shakes for offices, sets and parties. Send us a message and we'll set it up.";

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: "/catering/",
  image: OG_SPREAD,
});

type Color = keyof typeof MONSTER_COLORS;

/**
 * The crowd along the bottom of the hero: the room the headline promises to
 * feed. `l`/`w` place a monster on a phone, `ld`/`wd` on desktop, both as a
 * percentage of the strip's width; `desk` ones only show on desktop.
 */
const CROWD: Array<{ c: Color; l: number; w: number; ld: number; wd: number; desk?: true }> = [
  { c: "red", l: -4, w: 21, ld: -1, wd: 10.5 },
  { c: "blue", l: 14, w: 26, ld: 9, wd: 12 },
  { c: "yellow", l: 34, w: 30, ld: 20, wd: 14 },
  { c: "lime", l: 58, w: 23, ld: 32, wd: 10.5 },
  { c: "yellow", l: 76, w: 25, ld: 42, wd: 13 },
  { c: "blue", l: 94, w: 24, ld: 54, wd: 11.5 },
  { c: "yellow", l: 0, w: 0, ld: 65, wd: 13.5, desk: true },
  { c: "red", l: 0, w: 0, ld: 77, wd: 10.5, desk: true },
  { c: "blue", l: 0, w: 0, ld: 88, wd: 12.5, desk: true },
];

const STEPS = [
  {
    title: "Send us a message",
    text: "Sliders, fries and shakes for however many people are coming.",
  },
  { title: "Set the time and place", text: "Your office, your set, your party." },
  { title: "We smash it and send it", text: "Straight off the griddle, packed to travel." },
];

/**
 * Catering is arranged with the owners through the contact form (owner,
 * 2026-09-27: not ezCater), and the owner wants no hours, minimums or fees on
 * the site, so this page is a pitch and a button, the same shape as /careers/
 * is for Indeed: the food, three steps and a button to the contact form. No
 * prices on the food cards for the same reason.
 *
 * The art: a crowd of the artist's monsters along the bottom of the red panel
 * (the "whole room"), the checkerboard floor under them, an op-art bullseye in
 * the ORDER yellow, "Three steps" on his blue with a paint drip, and a monster
 * peeking over the last card. All of it is the shared symbol set `MascotDefs`
 * already puts on every page, so none of it is a download.
 *
 * Every catering button carries `data-catering` (so the click is a
 * `catering_click`) inside a `data-surface`, so Analytics shows them by spot.
 */
export default function CateringPage() {
  const food = FEATURED_OTTER_IDS.map((id) => allItems.find((i) => i.otterId === id)).filter(
    (i): i is MenuItem => Boolean(i),
  );

  return (
    <div className="cne-cat">
      <JsonLdScript data={breadcrumbLd([{ name: "Catering", path: "/catering/" }])} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/catering/#page`,
          url: `${brand.siteUrl}/catering/`,
          name: `Catering — ${brand.name}`,
          description,
          inLanguage: "en-US",
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
          significantLink: [`${brand.siteUrl}${CATERING_HREF}`],
        }}
      />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${brand.siteUrl}/catering/#service`,
          name: `${brand.name} catering`,
          serviceType: "Catering",
          description,
          provider: { "@id": ID.org },
          areaServed: { "@type": "City", name: "Los Angeles" },
          availableChannel: {
            "@type": "ServiceChannel",
            serviceUrl: `${brand.siteUrl}${CATERING_HREF}`,
            name: `Contact ${brand.name}`,
          },
        }}
      />

      <section className="cne-cat-hero" aria-labelledby="cat-h1" data-surface="catering-hero">
        <svg
          className="cne-cat-stamp"
          viewBox="0 0 200 200"
          aria-hidden="true"
          focusable="false"
          style={{ "--op-b": "var(--a-yel)" } as CSSProperties}
        >
          <use href="#cne-bullseye" />
        </svg>
        <p className="cne-cat-k">Offices &middot; Parties &middot; Sets</p>
        <h1 id="cat-h1">
          Sliders for
          <br /> <span className="y">the whole room.</span>
        </h1>
        <p className="cne-cat-lede">
          {brand.name} catering for offices, sets and parties. Tell us about yours.
        </p>
        <div className="cne-cat-cta">
          <Link
            prefetch={false}
            className="cne-big is-primary"
            href={CATERING_HREF}
            data-catering=""
          >
            ASK ABOUT CATERING &rarr;
          </Link>
          <Link prefetch={false} className="cne-hero-menu" href="/menu/">
            SEE THE MENU
          </Link>
        </div>
        <ul className="cne-cat-crowd" aria-hidden="true">
          {CROWD.map((m, i) => (
            <li
              key={i}
              className={m.desk ? "is-desk" : undefined}
              style={
                {
                  "--l": `${m.l}%`,
                  "--w": `${m.w}%`,
                  "--ld": `${m.ld}%`,
                  "--wd": `${m.wd}%`,
                } as CSSProperties
              }
            >
              <Monster
                species="classic"
                bodyColor={MONSTER_COLORS[m.c].body}
                irisColor={MONSTER_COLORS[m.c].iris}
                size={200}
              />
            </li>
          ))}
        </ul>
      </section>
      <div className="cne-cat-floor" aria-hidden="true" />

      {/* On the first phone screen, so it ships eagerly. On phones the 2:1 crop
          is wider than the screen, so the photo is drawn about 118vw wide. */}
      <div className="cne-cat-spread">
        <ArtPhoto
          name="spread-catering"
          widths={[720, 1080, 1600, 2400]}
          width={2400}
          height={1018}
          sizes="(max-width: 600px) 118vw, 100vw"
          alt="Side-on view of a Chris N Eddy’s spread on a red table: sliders, a grilled cheese, fries, cheese fries and vanilla, strawberry and chocolate shakes."
          priority
        />
      </div>

      <section className="cne-sec is-band cne-op-glyph cne-cat-food" aria-labelledby="cat-food">
        <GlyphRow />
        <div className="cne-eyebrow">&#9733; What travels best</div>
        <h2 id="cat-food">What the room orders.</h2>
        <ul className="cne-cardgrid">
          {food.map((it, i) => (
            <li key={it.id} className={`cne-card${i === 0 ? " is-star" : ""}`}>
              <span className="cne-card-img">
                {it.photo && (
                  <MenuPhoto
                    photo={it.photo}
                    sizes="(min-width: 901px) 440px, (min-width: 600px) 260px, 90px"
                    alt={itemPhotoAlt(it)}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                {i === 0 && (
                  <span className="cne-card-rib" aria-hidden="true">
                    MOST ORDERED
                  </span>
                )}
              </span>
              <span className="cne-card-body">
                <h3>{it.name}</h3>
                <p>{it.desc}</p>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cne-cat-blue" aria-labelledby="cat-steps">
        <div className="cne-eyebrow">How it works</div>
        <h2 id="cat-steps">Three steps.</h2>
        <ol className="cne-cat-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="n" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <DripEdge color="var(--a-blue)" seed={3} />

      <section className="cne-cat-end" aria-labelledby="cat-end" data-surface="catering-end">
        <div className="cne-cat-endcard">
          <Monster
            species="classic"
            bodyColor={MONSTER_COLORS.blue.body}
            irisColor={MONSTER_COLORS.blue.iris}
            size={74}
            className="cne-cat-peek"
          />
          <h2 id="cat-end">
            <span className="scr">Feeding a crowd?</span>
            We&rsquo;ll bring the sliders.
          </h2>
          <Link
            prefetch={false}
            className="cne-big is-primary"
            href={CATERING_HREF}
            data-catering=""
          >
            ASK ABOUT CATERING &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
