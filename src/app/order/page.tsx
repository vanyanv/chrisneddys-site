import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { SLIDER_PRICE, COMBO_FROM_PRICE } from "@/data/menu";
import { deliveryPlatforms, cateringPlatform } from "@/data/delivery";
import { storeUrl, orderUrl } from "@/lib/otter";
import { googleDirections } from "@/lib/directions";
import { slugFor, neighbourhoodFor } from "@/lib/locationSlug";
import { JsonLdScript, flagshipRestaurantLd } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";

const title = "Order Now — Hollywood Pickup, Open Late";
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
    a: "Order online from our Hollywood location at 5539 W. Sunset Blvd through our Otter storefront, or call (323) 544-3600. Every item on this site links straight to its page on the storefront with the add-to-cart sheet already open.",
  },
  {
    q: "What time does Chris N Eddy's close?",
    a: "The Hollywood location is open 10AM to 1AM Monday through Thursday, and 10AM to 2AM Friday, Saturday and Sunday.",
  },
  {
    q: "What is a Chris N Eddy's slider?",
    a: "Two smashed patties and two slices of cheese in a buttered, toasted Martin's potato roll. Order it Chris's Way with lettuce, tomato, sauce and raw onion, or Eddy's Way with sauce and grilled onion — every topping is free either way.",
  },
  {
    q: "Do you deliver?",
    a: "Yes — DoorDash, Uber Eats and Grubhub all deliver from the Hollywood location, and each is linked on this page. Ordering direct on our own storefront is pickup only, and it is the cheaper way to buy: the delivery apps set their own prices and add their own fees.",
  },
  {
    q: "How late are you open?",
    a: "Late. The Hollywood location serves until 1AM Monday through Thursday and until 2AM Friday, Saturday and Sunday — the kitchen is still smashing patties long after most places in Hollywood have closed for the night.",
  },
  {
    q: "Do the toppings cost extra?",
    a: "No. Every topping is free — CNE sauce, lettuce, tomato, raw onions, grilled onions and pickles. Order it Chris's Way or Eddy's Way and you pay the price on the menu. Extra cheese is $1 and making it halal is $2; nothing else is a surcharge.",
  },
  {
    q: "Do you cater?",
    a: "Yes. Office and event catering runs through ezCater, linked on this page. For anything it does not cover — a large order, a private event, a press or partnership question — use the form on our contact page or call (323) 544-3600.",
  },
  {
    q: "Is there parking?",
    a: "There is street parking along W. Sunset Blvd and the residential streets just off it. We're a walk-up on Sunset between Western and Normandie, so a pickup order is usually quicker to collect than it is to find a space for a sit-down meal.",
  },
  {
    q: "Do you have anything vegetarian?",
    a: "The grilled cheese — two slices of cheese in a buttered, reverse-toasted Martin's potato bun — plus chris-cut fries, cheese fries and the shakes. Everything else on the menu is beef.",
  },
  {
    q: "Can I order from the Glendale or Van Nuys locations?",
    a: "Not yet — those locations have not opened. Until they do, every order runs through Hollywood.",
  },
];


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
      {/* The store this page orders from. */}
      <JsonLdScript data={flagshipRestaurantLd()} />
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
          Online ordering runs through our Otter storefront at the Hollywood location, 5539 W.
          Sunset Blvd. Prices there are the pickup prices you see on{" "}
          <Link href="/menu/" style={{ textDecoration: "underline", color: "inherit" }}>
            our menu
          </Link>{" "}
          — sliders from ${SLIDER_PRICE.toFixed(2)}, combos from ${COMBO_FROM_PRICE.toFixed(2)}, and
          every topping free. Rather talk to someone? Call {brand.phone}.
        </p>
        <div className="cne-loc-btns" style={{ marginTop: 16 }} data-surface="order-page">
          <a className="cne-mini is-red" href={orderUrl("order-page")} target="_blank" rel="noopener noreferrer">
            ORDER ONLINE
          </a>
          <a className="cne-mini is-plain" href={`tel:${brand.phoneTel}`}>
            CALL {brand.phone}
          </a>
        </div>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Where it comes from</div>
        <h2>Pick your location.</h2>
        {locations.map((loc) => (
          <div
            key={loc.id}
            className={`cne-loc ${loc.isOpen ? "is-live" : "is-soon"}`}
            style={{ marginTop: 14 }}
            data-surface="location-card"
            data-location={slugFor(loc)}
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
                      href={orderUrl("location-card")}
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
                  {loc.phoneTel && (
                    <a className="cne-mini is-plain" href={`tel:${loc.phoneTel}`}>
                      CALL
                    </a>
                  )}
                </div>
              </>
            ) : (
              // No hours, no phone and no order link for a location that is not
              // serving yet — every one of them would be a dead end.
              <div className="cne-loc-note">Opening date to be announced.</div>
            )}
            <Link href={`/locations/${slugFor(loc)}/`} className="cne-loc-note cne-loc-more">
              {neighbourhoodFor(loc)} hours &amp; directions &rarr;
            </Link>
          </div>
        ))}
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">If you would rather not move</div>
        <h2>Delivery.</h2>
        <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, color: "var(--a-sub)" }}>
          Three apps deliver from the Hollywood location. They set their own prices and add
          their own fees, so ordering direct above is the cheaper way to eat the same food —
          but at 1AM in the rain, this is why we are on all three.
        </p>
        <div className="cne-loc-btns" style={{ marginTop: 16 }} data-surface="order-page">
          {deliveryPlatforms.map((platform) => (
            <a
              key={platform.id}
              className="cne-mini is-plain"
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {platform.name.toUpperCase()}
            </a>
          ))}
        </div>

        <h3 style={{ marginTop: 28, fontSize: 14 }}>Catering and large orders</h3>
        <p style={{ maxWidth: "62ch", fontSize: 14, lineHeight: 1.6, color: "var(--a-sub)" }}>
          Office lunches and events run through {cateringPlatform.name}. For anything it does
          not cover — a private event, a press or partnership question — the{" "}
          <Link href="/contact/" style={{ textDecoration: "underline", color: "inherit" }}>
            contact page
          </Link>{" "}
          reaches a real person.
        </p>
        <div className="cne-loc-btns" style={{ marginTop: 12 }} data-surface="order-page">
          <a
            className="cne-mini is-plain"
            href={cateringPlatform.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            CATERING ON {cateringPlatform.name.toUpperCase()}
          </a>
        </div>
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
