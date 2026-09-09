import type { Metadata } from "next";
import { MenuBrowser } from "@/components/counter/MenuBrowser";
import { JsonLdScript, menuNode } from "@/components/shared/JsonLd";
import { breadcrumbLd, openGraphFor, twitterFor } from "@/lib/seo";

const title = "Menu & Prices — Sliders, Combos, Fries & Shakes";
const description =
  "The full Chris N Eddy's menu with live pickup prices: sliders from $6.49, combos from $11.49, chris-cut fries, shakes and the Secret Menu. Tap any item to order.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/menu/" },
  openGraph: openGraphFor({ title: `${title} · Chris N Eddy's`, description, path: "/menu/" }),
  twitter: twitterFor({ title: `${title} · Chris N Eddy's`, description }),
};

export default function MenuPage() {
  return (
    <>
      {/* The one page that carries the whole Menu node — every item, every
          price. Elsewhere the Restaurant nodes point at the stub. */}
      <JsonLdScript data={{ "@context": "https://schema.org", ...menuNode() }} />
      <JsonLdScript data={breadcrumbLd([{ name: "Menu", path: "/menu/" }])} />
      <MenuBrowser />
    </>
  );
}
