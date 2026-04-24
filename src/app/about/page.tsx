import type { Metadata } from "next";
import { AboutHero } from "@/components/about/AboutHero";
import { StoryCopy } from "@/components/about/StoryCopy";
import { Timeline } from "@/components/about/Timeline";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Chris and Eddy: two childhood friends, a Hollywood parking lot, nine months of recipe testing, and a cult smash burger following.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <div style={{ background: "var(--color-cne-cream)", paddingBottom: 80 }}>
      <AboutHero />
      <StoryCopy />
      <Timeline />
    </div>
  );
}
