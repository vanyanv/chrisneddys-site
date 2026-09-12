import type { Metadata } from "next";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { neighbourhoodFor, slugFor } from "@/lib/locationSlug";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";
import { GuestCheck } from "@/components/contact/GuestCheck";

const title = "Contact Us — Catering, Press & Questions";
const description =
  "Catering, press, partnerships or a problem with an order — one form at Chris N Eddy’s, answered by a real person. Or call (323) 544-3600.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact/" },
  openGraph: openGraphFor({ title: `${title} · ${brand.name}`, description, path: "/contact/" }),
  twitter: twitterFor({ title: `${title} · ${brand.name}`, description }),
};

/**
 * The three questions people send us that the page can answer itself. Kept in
 * the sender's words, and lifted from /order/'s FAQ so the two pages can never
 * drift into two different answers.
 *
 * No FAQPage node is emitted for them. /order/ already owns that markup for the
 * same three answers, and two URLs claiming the same Q&A entities compete with
 * each other for a result neither would win twice.
 */
const DEFLECT: Array<{ q: string; a: string }> = [
  {
    q: "Do you deliver?",
    a: "Ordering on this site is pickup from the Hollywood location. Delivery is available through the third-party apps that carry us, at their own prices.",
  },
  {
    q: "Can I order from Glendale or Van Nuys?",
    a: "Not yet — those locations have not opened. Until they do, every order runs through Hollywood.",
  },
  {
    q: "What time do you close?",
    a: "1AM Monday through Thursday. 2AM Friday, Saturday and Sunday.",
  },
];

export default function ContactPage() {
  /**
   * ContactPage is the type Google expects at this URL, and `contactPoint` is
   * where a phone number on a contact page is actually read from — the sitewide
   * Organization node carries one, but nothing ties it to this page without it.
   */
  const contactLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${brand.siteUrl}/contact/#page`,
    url: `${brand.siteUrl}/contact/`,
    name: `Contact ${brand.name}`,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": ID.website },
    about: { "@id": ID.org },
    mainEntity: {
      "@id": ID.org,
      "@type": "Organization",
      name: brand.name,
      url: brand.siteUrl,
      email: brand.email,
      telephone: brand.phoneIntl,
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          telephone: brand.phoneIntl,
          email: brand.email,
          areaServed: "US",
          availableLanguage: "English",
        },
        {
          "@type": "ContactPoint",
          contactType: "sales",
          name: "Catering & events",
          email: brand.email,
          areaServed: "US",
          availableLanguage: "English",
        },
      ],
    },
  };

  return (
    <>
      <JsonLdScript data={breadcrumbLd([{ name: "Contact", path: "/contact/" }])} />
      <JsonLdScript data={contactLd} />

      <section className="cne-ct-hero" aria-labelledby="ct-h1">
        <div className="cne-halftone" />
        <div className="cne-ct-hero-in">
          <div className="cne-ct-hero-copy">
            <p className="cne-ct-eyebrow">Contact</p>
            <h1 id="ct-h1">Get in touch</h1>
            <p className="cne-ct-lede">
              Catering, press, a burger that showed up wrong — it all lands in the same inbox,
              and a real person reads it.
            </p>
          </div>
        </div>
      </section>

      <div className="cne-ct-wrap">
        <div className="cne-ct-main cne-rv">
          <GuestCheck />
        </div>

        <aside className="cne-ct-rail">
          <div className="cne-ct-card cne-rv">
            <h2 className="cne-ct-cardh">Where we are</h2>
            <ul className="cne-ct-locs">
              {locations.map((loc) => (
                <li className="cne-ct-loc" key={loc.id}>
                  <a href={`/locations/${slugFor(loc)}/`}>
                    <span className="cne-ct-locn">{neighbourhoodFor(loc)}</span>
                    <span className="cne-ct-loca">
                      {loc.isOpen ? loc.address : loc.status}
                    </span>
                  </a>
                  <span className={`cne-ct-tag${loc.isOpen ? " is-open" : ""}`}>
                    {loc.isOpen ? "Open" : "Soon"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="cne-ct-faq cne-rv">
            <h2 className="cne-ct-cardh">Answered already</h2>
            {DEFLECT.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
