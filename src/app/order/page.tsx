import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { menu } from "@/data/menu";
import { storeUrl } from "@/lib/otter";
import { googleDirections } from "@/lib/directions";
import { slugFor, neighbourhoodFor } from "@/lib/locationSlug";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";

const title = "Order Now — Pickup From Our Hollywood Counter";
const description =
  "Order Chris N Eddy's smash burgers online for pickup in Hollywood, or call (323) 544-3600. Live menu prices, open till 1AM weeknights and 2AM Fri–Sun.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/order/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/order/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

/**
 * The answers people actually type before they order, in their words. Written
 * as questions because that is how they are asked — of the site, of Google, and
 * increasingly of an assistant reading the page instead of showing it.
 */
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How do I order from Chris N Eddy's?",
    a: "Order online from our Hollywood counter at 5539 W. Sunset Blvd through our Otter storefront, or call (323) 544-3600. Every item on this site links straight to its page on the storefront with the add-to-cart sheet already open.",
  },
  {
    q: "What time does Chris N Eddy's close?",
    a: "The Hollywood counter is open 10AM to 1AM Monday through Thursday, and 10AM to 2AM Friday, Saturday and Sunday.",
  },
  {
    q: "What is a Chris N Eddy's slider?",
    a: "Two smashed patties and two slices of cheese in a buttered, toasted Martin's potato roll. Order it Chris's Way with lettuce, tomato, sauce and raw onion, or Eddy's Way with sauce and grilled onion — every topping is free either way.",
  },
  {
    q: "Do you deliver?",
    a: "Ordering on this site is pickup from the Hollywood counter. Delivery is available through the third-party apps that carry us, at their own prices.",
  },
  {
    q: "Can I order from the Glendale or Van Nuys locations?",
    a: "Not yet — those counters have not opened. Until they do, every order runs through Hollywood.",
  },
];

const cheapestSlider = Math.min(...menu.combos.map((i) => i.price));

export default function OrderPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <JsonLdScript data={breadcrumbLd([{ name: "Order", path: "/order/" }])} />
      <JsonLdScript data={faqLd} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/order/#page`,
          url: `${brand.siteUrl}/order/`,
          name: `Order ${brand.name}`,
          description,
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
          significantLink: storeUrl,
        }}
      />

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Pickup from Hollywood</div>
        <h1>Order now.</h1>
        <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, color: "var(--a-sub)" }}>
          Online ordering runs through our Otter storefront at the Hollywood counter, 5539 W.
          Sunset Blvd. Prices there are the pickup prices you see on{" "}
          <Link href="/menu/" style={{ textDecoration: "underline", color: "inherit" }}>
            our menu
          </Link>{" "}
          — combos from ${cheapestSlider.toFixed(2)}, and every topping free. Rather talk to
          someone? Call {brand.phone}.
        </p>
        <div className="cne-loc-btns" style={{ marginTop: 16 }}>
          <a className="cne-mini is-red" href={storeUrl} target="_blank" rel="noopener noreferrer">
            ORDER ONLINE
          </a>
          <a className="cne-mini is-plain" href={`tel:${brand.phoneTel}`}>
            CALL {brand.phone}
          </a>
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Where it comes from</div>
        <h2>Pick your counter.</h2>
        {locations.map((loc) => (
          <div
            key={loc.id}
            className={`cne-loc ${loc.isOpen ? "is-live" : "is-soon"}`}
            style={{ marginTop: 14 }}
          >
            <h3>{neighbourhoodFor(loc).toUpperCase()}</h3>
            <address className="cne-loc-addr" style={{ fontStyle: "normal" }}>
              {loc.address}
              <br />
              {loc.city}, {loc.region} {loc.postal}
            </address>
            {loc.isOpen ? (
              <>
                <div className="cne-loc-hrs">
                  {loc.hours.map(([day, hrs]) => (
                    <div className="r" key={day}>
                      <span>{day.toUpperCase()}</span>
                      <b>{hrs}</b>
                    </div>
                  ))}
                </div>
                <div className="cne-loc-btns">
                  {loc.id === "hollywood" && (
                    <a
                      className="cne-mini is-red"
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ORDER
                    </a>
                  )}
                  <a
                    className="cne-mini is-plain"
                    href={googleDirections(loc)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    DIRECTIONS
                  </a>
                  <a className="cne-mini is-plain" href={`tel:${brand.phoneTel}`}>
                    CALL
                  </a>
                </div>
              </>
            ) : (
              // No hours, no phone and no order link for a counter that is not
              // serving yet — every one of them would be a dead end.
              <div className="cne-loc-note">Opening date to be announced.</div>
            )}
            <Link href={`/locations/${slugFor(loc)}/`} className="cne-loc-note cne-loc-more">
              {neighbourhoodFor(loc)} hours &amp; directions &rarr;
            </Link>
          </div>
        ))}
      </section>

      <section className="cne-sec cne-rv" style={{ paddingBottom: 40 }}>
        <div className="cne-eyebrow">Before you order</div>
        <h2>Questions, answered.</h2>
        <dl style={{ maxWidth: "62ch", margin: "14px 0 0" }}>
          {FAQ.map(({ q, a }) => (
            <div key={q} style={{ marginTop: 16 }}>
              <dt style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>{q}</dt>
              <dd
                style={{
                  margin: "5px 0 0",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--a-sub)",
                }}
              >
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
