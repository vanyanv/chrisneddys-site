import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { ValueProps } from "@/components/home/ValueProps";
import { Signatures } from "@/components/home/Signatures";
import { StoryBand } from "@/components/home/StoryBand";
import { PressWall } from "@/components/home/PressWall";
import { IGStrip } from "@/components/home/IGStrip";

export const metadata: Metadata = {
  title: "Smashed sliders in Hollywood",
  description:
    "Two childhood friends, one parking lot, and a smash burger cult following. Smashed sliders on buttered Martin’s potato rolls — open til 2AM on Sunset.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ValueProps />
      <Signatures />
      <StoryBand />
      <PressWall />
      <IGStrip />
    </>
  );
}
