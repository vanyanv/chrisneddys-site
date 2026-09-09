import Link from "next/link";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { slugFor, neighbourhoodFor } from "@/lib/locationSlug";

/**
 * The footer is the only place every page of the site is linked from. That is
 * what a crawler reads a site's shape off, and what the sitelinks under a brand
 * result are drawn from — so the whole tree is here, in one row, by name.
 */
const NAV = [
  { href: "/menu/", label: "Menu" },
  { href: "/order/", label: "Order online" },
  { href: "/locations/", label: "Locations" },
  ...locations.map((loc) => ({
    href: `/locations/${slugFor(loc)}/`,
    label: neighbourhoodFor(loc),
  })),
  { href: "/about/", label: "Our story" },
];

export function SiteFooter() {
  return (
    <footer className="cne-foot">
      <div>
        <b>CHRIS N EDDY&rsquo;S</b> — Smashed sliders, done right. Pop-up in 2020, Hollywood
        since 2021.
      </div>
      <nav className="cne-foot-nav" aria-label="Footer">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} style={linkStyle}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div>
        Hollywood · Glendale · Van Nuys ·{" "}
        <a href={`tel:${brand.phoneTel}`} style={linkStyle}>
          {brand.phone}
        </a>{" "}
        ·{" "}
        <a href={brand.igUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {brand.ig}
        </a>
      </div>
    </footer>
  );
}

// Underline comes from counter.css (.cne-foot a) so the link is identifiable
// without relying on colour alone.
const linkStyle = { color: "var(--a-yel)" };
