import type { Metadata } from "next";
import { MenuBrowser } from "@/components/counter/MenuBrowser";

const description =
  "Smashed sliders, combos, fries and shakes with live pickup prices. Order any slider Chris’s Way or Eddy’s Way — every topping is free. Tap any item to order it online.";

export const metadata: Metadata = {
  title: "Menu",
  description,
  alternates: { canonical: "/menu/" },
  openGraph: {
    title: "Menu · Chris N Eddy's",
    description,
    url: "/menu/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Menu · Chris N Eddy's",
    description,
  },
};

export default function MenuPage() {
  return <MenuBrowser />;
}
