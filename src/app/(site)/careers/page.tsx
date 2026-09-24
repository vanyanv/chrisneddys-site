import type { Metadata } from "next";
import "@/styles/careers.css";
import { brand } from "@/data/brand";
import { JsonLdScript } from "@/components/shared/JsonLd";
import Link from "next/link";
import { hasPassed, locations, VAN_NUYS_OPENS_AT } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";
import { Monster } from "@/components/mascots/Monster";
import { DripEdge } from "@/components/storeart/DripEdge";
import { ArtPhoto } from "@/components/art/ArtPhoto";
import { MascotDecor } from "@/components/mascots/MascotDecor";
import { locationMonster } from "@/components/locations/locationArt";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";

const title = "Careers";
const description =
  "Chris N Eddy's is hiring across Hollywood, Glendale and Van Nuys. See open roles and apply on Indeed.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/careers/" });

const INDEED_URL = "https://www.indeed.com/cmp/Chris-N-Eddy's";

/**
 * No job data lives in this codebase — Indeed is the system of record for
 * postings, so this page is a pitch and a link, not a listings page. That is
 * also why there is no JobPosting structured data here: that schema promises
 * per-role fields (title, date, employment type) this page does not have and
 * would have no way to keep in sync with what Indeed actually shows.
 *
 * Its own red-band hero and framed photo (off `legal.css`, which /privacy,
 * /terms and /returns still use) — see careers.css. The art pass: the crew is
 * the three stores' monsters lined up in the hero, the photo is the Hollywood
 * mural wall, and each store gets a tile in its own monster's colour.
 */
export default function CareersPage() {
  // The copy changes by itself when Van Nuys opens; this page regenerates
  // every minute, like the rest of the storefront.
  const vanNuysOpen = hasPassed(VAN_NUYS_OPENS_AT);
  return (
    <div className="cne-cr">
      <JsonLdScript data={breadcrumbLd([{ name: "Careers", path: "/careers/" }])} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/careers/#page`,
          url: `${brand.siteUrl}/careers/`,
          name: `${title} — ${brand.name}`,
          description,
          inLanguage: "en-US",
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
        }}
      />

      <section className="cne-cr-hero" aria-labelledby="cr-h1">
        <div className="cne-halftone" aria-hidden="true" />
        <div className="cne-cr-hero-in">
          <p className="cne-cr-eyebrow">Careers</p>
          <h1 id="cr-h1">Join the crew.</h1>
          <p className="cne-cr-lede">
            {vanNuysOpen ? (
              <>
                Hollywood and Van Nuys are open now. Glendale is next &mdash; that&rsquo;s more
                shifts, more kitchens, more people.
              </>
            ) : (
              <>
                Hollywood is open now. Glendale and Van Nuys are next &mdash; that&rsquo;s more
                shifts, more kitchens, more people.
              </>
            )}
          </p>
        </div>
        {/* The crew: one monster per store, in the store's own colour, asleep
            until that store has an opening date. */}
        <ul className="cne-cr-crew" aria-hidden="true">
          {locations.map((l) => {
            const m = locationMonster(l.id);
            return (
              <li key={l.id}>
                <Monster
                  species={l.isOpen || l.openingAnnouncement ? "classic" : "classic-sleep"}
                  bodyColor={m.body}
                  irisColor={m.iris}
                  size={96}
                />
              </li>
            );
          })}
        </ul>
      </section>
      {/* Idea 3: paint drips off the hero's own red. */}
      <DripEdge color="var(--a-red-cta)" seed={2} />

      <div className="cne-cr-body">
        <div className="cne-cr-photo cne-rv">
          {/* This is the LCP element on phones, so it ships eagerly and at high
              priority — unlike the gallery photos elsewhere on the site, which are
              genuinely below the fold. `sizes` is measured from `.cne-cr-photo`
              in careers.css. Regenerate the cuts with `pnpm images:art` if the
              source photo changes. */}
          <ArtPhoto
            name="hollywood-wall"
            widths={[480, 720, 900]}
            width={900}
            height={506}
            sizes="(min-width: 901px) 672px, (min-width: 790px) 730px, calc(100vw - 30px)"
            alt="The dining room wall at Chris N Eddy's Hollywood: grinning one-eyed monsters, checkerboards, bullseyes and Sliders tags painted over the tables."
            priority
          />
        </div>

        <div className="cne-cr-pitch cne-rv">
          <p>
            {vanNuysOpen
              ? "We’re a Hollywood smash-burger spot that has just opened in Van Nuys, with Glendale next — that means more shifts, more kitchens and more people needed to run them."
              : "We’re a Hollywood smash-burger spot opening two more locations, in Glendale and Van Nuys — that means more shifts, more kitchens and more people needed to run them."}
          </p>
          <p>
            Open roles, pay and how to apply all live on our Indeed page, kept current there rather
            than copied here where it could go stale.
          </p>
        </div>

        <section className="cne-cr-stores cne-rv" aria-labelledby="cr-stores">
          <h2 id="cr-stores">Our locations</h2>
          <ul>
            {locations.map((l) => {
              const m = locationMonster(l.id);
              return (
                <li key={l.id}>
                  <Link
                    prefetch={false}
                    href={`/locations/${slugFor(l)}/`}
                    className={`cne-cr-store ${l.isOpen ? "is-live" : "is-soon"}`}
                  >
                    <Monster
                      species={l.isOpen || l.openingAnnouncement ? "classic" : "classic-sleep"}
                      bodyColor={m.body}
                      irisColor={m.iris}
                      size={48}
                    />
                    <span className="cne-cr-store-name">{l.neighbourhood}</span>
                    {/* The store's own static status line ("Open daily"), not the
                        live clock: this page has no other client code, and it
                        is a jobs page, not a place to check the hours. */}
                    <span className="cne-cr-store-note">{l.status}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="cne-cr-roles cne-rv" aria-labelledby="cr-roles">
          <div className="cne-cr-card">
            <MascotDecor
              kind="bullseye"
              colorA="#1a1612"
              colorB="#fff2c9"
              size={84}
              className="cne-cr-card-eye"
            />
            <p className="cne-cr-card-eyebrow">Open roles &middot; live on Indeed</p>
            <h2 id="cr-roles">See what&rsquo;s hiring right now.</h2>
            <p>
              Pay and how to apply are kept current there, not copied here where they&rsquo;d go
              stale.
            </p>
            <a
              className="cne-big is-primary"
              href={INDEED_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              SEE OPEN ROLES ON INDEED &rarr;
            </a>
          </div>
        </section>

        <section className="cne-sec cne-rv" aria-labelledby="cr-contact">
          <h2 id="cr-contact">Questions</h2>
          <p>
            Nothing open that fits, or a question before you apply? Reach us through our{" "}
            <a href="/contact/">contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
