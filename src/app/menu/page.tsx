import type { Metadata } from "next";
import { MenuHero } from "@/components/menu/MenuHero";
import { MenuSection } from "@/components/menu/MenuSection";
import { Toppings } from "@/components/menu/Toppings";
import { MenuDisclaimer } from "@/components/menu/MenuDisclaimer";
import { OrderFab } from "@/components/menu/OrderFab";

const description =
  "Smashed sliders, combos, fries, cheese fries, loaded fries, and shakes. Order any slider Chris’s Way or Eddy’s Way. All toppings at no extra charge.";

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
  return (
    <div style={{ background: "var(--color-cne-cream)", paddingBottom: 80 }}>
      <MenuHero />
      <MenuSection category="sliders" />
      <MenuSection category="ways" />
      <MenuSection category="combos" />
      <MenuSection category="sides" />
      <MenuSection category="drinks" />
      <Toppings />
      <MenuDisclaimer />
      <OrderFab />
    </div>
  );
}
