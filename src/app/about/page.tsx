import type { Metadata } from "next";
import { AboutHero } from "@/components/about/AboutHero";
import { StoryCopy } from "@/components/about/StoryCopy";
import { Timeline } from "@/components/about/Timeline";

const description =
  "Chris and Eddy: two childhood friends, a Hollywood parking lot, nine months of recipe testing, and a cult smash burger following.";

export const metadata: Metadata = {
  title: "Our Story",
  description,
  alternates: { canonical: "/about/" },
  openGraph: {
    title: "Our Story · Chris N Eddy's",
    description,
    url: "/about/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Story · Chris N Eddy's",
    description,
  },
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
