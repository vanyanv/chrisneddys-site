import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { SLIDER_PRICE, COMBO_FROM_PRICE } from "@/data/menu";
import { deliveryFor, cateringPlatform } from "@/data/delivery";
import { sharedFaq, type FaqEntry } from "@/data/faq";
import { formatPrice } from "@/lib/otter";
import { slugFor } from "@/lib/locationSlug";
import { closingLine, openLocations, openNames, phoneList } from "@/lib/openLocations";
import { LocationCard } from "@/components/locations/LocationCard";
import { JsonLdScript, restaurantLd } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";

const title = "Order Now — Pickup, Open Late";
// Built per request of the metadata rather than at import, so a store that
// opens later joins the description by itself.
function description(): string {
  return `Order ${brand.name} smash burgers online for pickup in ${openNames("or")}. Live menu prices. ${closingLine()}.`;
}

export function generateMetadata(): Metadata {
  return pageMetadata({ title, description: description(), path: "/order/" });
}

/**
 * The answers people actually type before they order, in their words. Written
 * as questions because that is how they are asked — of the site, of Google, and
 * increasingly of an assistant reading the page instead of showing it.
 */
const FAQ: FaqEntry[] = [
  {
    q: "How do I order from Chris N Eddy's?",
    get a() {
      return `Order online from the location you are picking up at — ${openNames()} each have their own ORDER button on this page — or call that location: ${phoneList()}.`;
    },
  },
  // Shared with /contact/'s "Answered already" card — one answer, defined once,
  // in src/data/faq.ts.
  ...sharedFaq,
  {
    q: "What is a Chris N Eddy's slider?",
    a: "Two smashed patties and two slices of cheese in a buttered, toasted Martin's potato roll. Order it Chris's Way with lettuce, tomato, sauce and raw onion, or Eddy's Way with sauce and grilled onion — every topping is free either way.",
  },
  {
    q: "How late are you open?",
    get a() {
      return `Late. ${closingLine()} — the kitchen is still smashing patties long after most places around us have closed for the night.`;
    },
  },
  {
    q: "Do the toppings cost extra?",
    a: "No. Every topping is free — CNE sauce, lettuce, tomato, raw onions, grilled onions and pickles. Order it Chris's Way or Eddy's Way and you pay the price on the menu. Extra cheese is $1 and making it halal is $2; nothing else is a surcharge.",
  },
  {
    q: "Do you cater?",
    get a() {
      return `Yes. Office and event catering runs through ezCater, linked on this page. For anything it does not cover — a large order, a private event, a press or partnership question — use the form on our contact page or call us: ${phoneList()}.`;
    },
  },
  {
    q: "Is there parking?",
    // Owner, 2026-09-26.
    a: "Yes, at both. In Hollywood there is parking behind the store, and more in the WSS parking lot next door. In Van Nuys there is a parking lot right in front of the store.",
  },
  {
    q: "Do you have anything vegetarian?",
    a: "The grilled cheese — two slices of cheese in a buttered, reverse-toasted Martin's potato bun — plus chris-cut fries, cheese fries and the shakes. Everything else on the menu is beef.",
  },
];

export default function OrderPage() {
  // Split so a location that hasn't opened yet doesn't cost a phone the
  // same full card — address, hours placeholder, footer link — that an
  // actual pickup spot earns. See the compact row below (issue #108).
  const open = openLocations();
  const comingSoonLocations = locations.filter((loc) => !loc.isOpen);

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
      {/* The stores this page orders from. */}
      {open.map((loc) => (
        <JsonLdScript key={loc.id} data={restaurantLd(loc)} />
      ))}
      <JsonLdScript data={faqLd} />
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${brand.siteUrl}/order/#page`,
          url: `${brand.siteUrl}/order/`,
          name: `Order ${brand.name}`,
          description: description(),
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.org },
          significantLink: open.flatMap((loc) => (loc.orderUrl ? [loc.orderUrl] : [])),
        }}
      />

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Pickup from {openNames("or")}</div>
        <h1>Order now.</h1>
        <p className="cne-lede">
          Order online for pickup from {openNames("or")}. Pick your location below and it opens that
          location&rsquo;s ordering page. Prices are the pickup prices you see on{" "}
          <Link
            prefetch={false}
            href="/menu/"
            style={{ textDecoration: "underline", color: "inherit" }}
          >
            our menu
          </Link>{" "}
          — sliders from {formatPrice(SLIDER_PRICE)}, combos from {formatPrice(COMBO_FROM_PRICE)},
          and every topping free, at every location. Rather talk to someone? Call the location
          you&rsquo;re picking up from.
        </p>
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">Where it comes from</div>
        <h2>Pick your location.</h2>
        {open.map((loc) => (
          <div
            key={loc.id}
            className="cne-loc is-live"
            style={{ marginTop: 14 }}
            data-surface="location-card"
            data-location={slugFor(loc)}
          >
            <LocationCard
              loc={loc}
              surface="location-card"
              addressAs="address"
              addressStyle={{ fontStyle: "normal" }}
              footer={
                <Link
                  prefetch={false}
                  href={`/locations/${slugFor(loc)}/`}
                  className="cne-loc-note cne-loc-more"
                >
                  {loc.neighbourhood} hours &amp; directions &rarr;
                </Link>
              }
            />
          </div>
        ))}

        {/* Glendale and Van Nuys haven't opened, so each gets one compact
            row instead of a full card with an address, a placeholder hours
            line and a footer link — that's real space on a phone, and none
            of it is a fact yet. "Tell me when it opens" (issue #108) is the
            one thing worth a tap here; a "Details" link still reaches the
            store's own page for the rest. */}
        {comingSoonLocations.length > 0 && (
          <div
            style={{
              marginTop: 14,
              border: "2px solid var(--a-ink)",
              background: "var(--a-card)",
            }}
          >
            {comingSoonLocations.map((loc, i) => (
              <div
                key={loc.id}
                data-surface="location-card"
                data-location={slugFor(loc)}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 13px",
                  borderTop: i === 0 ? "none" : "1px solid var(--a-line)",
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <strong>{loc.neighbourhood.toUpperCase()}</strong> —{" "}
                  {loc.openingAnnouncement
                    ? `${loc.openingAnnouncement} at ${loc.address}, ${loc.city}, ${loc.region} ${loc.postal}`
                    : "opening soon"}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    prefetch={false}
                    href={`/locations/${slugFor(loc)}/`}
                    className="cne-mini is-plain"
                  >
                    DETAILS
                  </Link>
                  <Link
                    prefetch={false}
                    className="cne-mini is-red"
                    href={`/locations/${slugFor(loc)}/#notify`}
                  >
                    TELL ME WHEN IT OPENS
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cne-sec cne-rv">
        <div className="cne-eyebrow">If you would rather not move</div>
        <h2>Delivery.</h2>
        <p className="cne-lede">
          The delivery apps set their own prices and add their own fees, so ordering direct above is
          the cheaper way to eat the same food — but long after midnight, in the rain, this is why
          we are on them. Pick the location closest to you.
        </p>
        {open.map((loc) => {
          const apps = deliveryFor(loc.id);
          if (apps.length === 0) return null;
          return (
            <div key={loc.id} style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>{loc.neighbourhood}</h3>
              <div className="cne-loc-btns" data-surface="order-page" data-location={slugFor(loc)}>
                {apps.map((platform) => (
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
            </div>
          );
        })}

        <h3 style={{ marginTop: 28, fontSize: 14 }}>Catering and large orders</h3>
        <p className="cne-lede">
          Office lunches and events run through {cateringPlatform.name}. For anything it does not
          cover — a private event, a press or partnership question — the{" "}
          <Link
            prefetch={false}
            href="/contact/"
            style={{ textDecoration: "underline", color: "inherit" }}
          >
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
