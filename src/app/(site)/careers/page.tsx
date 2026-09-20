import type { Metadata } from "next";
import "@/styles/careers.css";
import { brand } from "@/data/brand";
import { JsonLdScript } from "@/components/shared/JsonLd";
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
 * /terms and /returns still use) — see careers.css.
 */
export default function CareersPage() {
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
            Hollywood is open now. Glendale and Van Nuys are next &mdash; that&rsquo;s more shifts,
            more kitchens, more people.
          </p>
        </div>
      </section>

      <div className="cne-cr-body">
        <div className="cne-cr-photo cne-rv">
          <img
            src="/photos/double-16x9.jpg"
            alt=""
            width={900}
            height={506}
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="cne-cr-pitch cne-rv">
          <p>
            We&rsquo;re a Hollywood smash-burger spot opening two more locations, in Glendale and
            Van Nuys &mdash; that means more shifts, more kitchens and more people needed to run
            them.
          </p>
          <p>
            Open roles, pay and how to apply all live on our Indeed page, kept current there rather
            than copied here where it could go stale.
          </p>
        </div>

        <section className="cne-cr-roles cne-rv" aria-labelledby="cr-roles">
          <div className="cne-cr-card">
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
