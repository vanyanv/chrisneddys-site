import type { Metadata } from "next";
import { MenuBrowser } from "@/components/counter/MenuBrowser";
import { openGraphFor, twitterFor } from "@/lib/seo";

const title = "Menu — Sliders, Combos, Fries & Shakes";
const description =
  "Our full menu with live pickup prices: sliders from $6.49, combos from $11.49, the Secret Menu, chris-cut fries and shakes. Tap any item to order it online.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/menu/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/menu/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

export default function MenuPage() {
  return <MenuBrowser />;
}
