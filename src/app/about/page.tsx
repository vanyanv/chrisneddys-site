import type { Metadata } from "next";
import { AboutHero } from "@/components/about/AboutHero";
import { StoryCopy } from "@/components/about/StoryCopy";
import { Timeline } from "@/components/about/Timeline";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor, ID } from "@/lib/seo";
import { brand } from "@/data/brand";

const title = "Our Story — A Parking Lot to Sunset Blvd";
const description =
  "At Chris N Eddy’s we are two childhood friends who turned a 2020 parking-lot pop-up into a Sunset Blvd counter. Nine months of testing, one smashed slider.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/about/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

/**
 * The founders are half of what people search when they search the brand, and
 * nothing else on the site states that they are the founders in a form a
 * machine can read. Both names are as NBC Los Angeles printed them.
 */
const aboutLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${brand.siteUrl}/about/#page`,
  url: `${brand.siteUrl}/about/`,
  name: `About ${brand.name}`,
  isPartOf: { "@id": ID.website },
  mainEntity: {
    "@id": ID.org,
    "@type": "Organization",
    name: brand.name,
    foundingDate: String(brand.founded),
    foundingLocation: {
      "@type": "Place",
      name: "Los Angeles, California",
    },
    founder: [
      { "@type": "Person", name: "Chris Karimian" },
      { "@type": "Person", name: "Eddy Poghosyan" },
    ],
  },
};

export default function AboutPage() {
  return (
    <div className="cne-legacy-theme" style={{ paddingBottom: 80 }}>
      <JsonLdScript data={breadcrumbLd([{ name: "About", path: "/about/" }])} />
      <JsonLdScript data={aboutLd} />
      <AboutHero />
      <StoryCopy />
      <Timeline />
    </div>
  );
}
