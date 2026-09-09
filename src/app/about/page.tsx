import type { Metadata } from "next";
import { AboutHero } from "@/components/about/AboutHero";
import { StoryCopy } from "@/components/about/StoryCopy";
import { Timeline } from "@/components/about/Timeline";
import { openGraphFor, twitterFor } from "@/lib/seo";

const title = "Our Story — A Parking Lot to Sunset Blvd";
const description =
  "Two childhood friends started Chris N Eddy’s as a pandemic pop-up in 2020 and opened on Sunset Blvd in 2021. Nine months of recipe testing, one smashed slider.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/about/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

export default function AboutPage() {
  return (
    <div className="cne-legacy-theme" style={{ paddingBottom: 80 }}>
      <AboutHero />
      <StoryCopy />
      <Timeline />
    </div>
  );
}
