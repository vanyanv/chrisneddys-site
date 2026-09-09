import type { Metadata } from "next";
import { MenuHero } from "@/components/menu/MenuHero";
import { MenuSection } from "@/components/menu/MenuSection";
import { Ways } from "@/components/menu/Ways";
import { Toppings } from "@/components/menu/Toppings";
import { MenuDisclaimer } from "@/components/menu/MenuDisclaimer";
import { OrderFab } from "@/components/menu/OrderFab";

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
  return (
    <div style={{ background: "var(--color-cne-cream)", paddingBottom: 80 }}>
      <MenuHero />
      <Ways />
      <MenuSection category="combos" />
      <MenuSection category="sides" />
      <MenuSection category="secret" />
      <MenuSection category="drinks" />
      <Toppings />
      <MenuDisclaimer />
      <OrderFab />
    </div>
  );
}
