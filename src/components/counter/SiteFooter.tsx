import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";

/**
 * The footer is the only place every page of the site is linked from. That is
 * what a crawler reads a site's shape off, and what the sitelinks under a brand
 * result are drawn from — so the whole tree is here, in one block, by name.
 *
 * The eight links are split into two named groups rather than run together.
 * That is the same eight links, not more: padding a sitewide footer out to
 * thirty is what gets the whole block discounted as boilerplate.
 */
const EAT = [
  { href: "/menu/", label: "Menu" },
  { href: "/order/", label: "Order online" },
  { href: "/shop/", label: "Shop" },
  { href: "/about/", label: "Our story" },
  { href: "/contact/", label: "Contact" },
];

const COUNTER_LINKS = [
  { href: "/locations/", label: "All locations" },
  ...locations.map((loc) => ({
    href: `/locations/${slugFor(loc)}/`,
    label: loc.neighbourhood,
  })),
];

/**
 * Whether a location prints an address is `isOpen`, the same flag the live
 * open/closed pill and the JSON-LD `openingHoursSpecification` are built from.
 * A store that is not serving gets its name and "Coming soon" and nothing else:
 * a street address under a location nobody can walk into is a claim the business
 * cannot honour, and it is the same claim the opening-hours spec already
 * refuses to make. Glendale and Van Nuys fill in when their flag flips.
 *
 * The phone is a second, narrower gate. Three addresses sharing the Hollywood
 * number is the pattern local search reads as a virtual office, so a location
 * prints a number only once it answers its own.
 */
export function SiteFooter() {
  return (
    // Declared once on the whole footer: the only tracked links down here are
    // the per-store phone numbers, and every one of them belongs to "footer".
    <footer className="cne-foot" data-surface="footer">
      <div className="cne-foot-top">
        <div className="cne-foot-brand">
          <Link href="/" aria-label={`${brand.name} — Home`} className="cne-foot-mark">
            <Image src="/cne-logo.webp" alt={brand.name} width={309} height={89} />
          </Link>
          <p>Smashed sliders, done right. Pop-up in {brand.founded}, Hollywood since 2021.</p>
          <a href={brand.igUrl} target="_blank" rel="noopener noreferrer">
            {brand.ig}
          </a>
        </div>

        <div className="cne-foot-group">
          <p className="cne-foot-h">Eat</p>
          <nav aria-label="Eat">
            <ul>
              {EAT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="cne-foot-group">
          <p className="cne-foot-h">Locations</p>
          <nav aria-label="Locations">
            <ul>
              {COUNTER_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="cne-foot-counters">
        {locations.map((loc) => (
          // The phone number inside reports which counter it rings. All three
          // share the Hollywood number today; two of them stop as they open.
          <div className="cne-foot-counter" key={loc.id} data-location={slugFor(loc)}>
            {/* A label, not a link: this location is already linked by name in
                the Locations column above, and two anchors on one URL in one
                block is the kind of duplication that makes a footer read as
                padded rather than as a map. */}
            <p className="cne-foot-h">{loc.neighbourhood}</p>
            {loc.isOpen ? (
              <>
                <address>
                  {loc.address}
                  <br />
                  {loc.city}, {loc.region} {loc.postal}
                  {loc.phone && loc.phoneTel ? (
                    <>
                      <br />
                      <a href={`tel:${loc.phoneTel}`}>{loc.phone}</a>
                    </>
                  ) : null}
                </address>
                <div className="cne-foot-hours">
                  {loc.hours.map(([days, time]) => (
                    <Fragment key={days}>
                      <span>{days}</span>
                      <span>{time}</span>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : (
              <p className="cne-foot-soon">Coming soon</p>
            )}
          </div>
        ))}
      </div>

      {/* The policy is linked from here rather than from the Eat column above:
          it belongs beside the copyright line, and adding a ninth link to the
          two named groups would pad the block those groups exist to keep tight. */}
      <div className="cne-foot-legal">
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
        <Link href="/privacy/">Privacy</Link>
      </div>
    </footer>
  );
}
