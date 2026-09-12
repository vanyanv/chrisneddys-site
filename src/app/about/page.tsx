import type { Metadata } from "next";
import { TwoWays } from "@/components/about/TwoWays";
import { StorySeam } from "@/components/about/StorySeam";
import { StoryColumns } from "@/components/about/StoryColumns";
import { StoryPress } from "@/components/about/StoryPress";
import { StoryClose } from "@/components/about/StoryClose";
import { JsonLdScript } from "@/components/shared/JsonLd";
import { breadcrumbLd, pageMetadata, ID } from "@/lib/seo";
import { brand } from "@/data/brand";

const title = "Our Story — A Parking Lot to Sunset Blvd";
const description =
  "Two childhood friends turned a 2020 parking-lot pop-up into a permanent spot on Sunset Blvd. Nine months of testing, one smashed slider.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/about/" });

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
    <div className="cne-story">
      <JsonLdScript data={breadcrumbLd([{ name: "About", path: "/about/" }])} />
      <JsonLdScript data={aboutLd} />
      <TwoWays />
      <StorySeam />
      <StoryColumns />
      <StoryPress />
      <StoryClose />
    </div>
  );
}
