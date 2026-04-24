import type { Metadata } from "next";
import { MenuHero } from "@/components/menu/MenuHero";
import { OrderStrip } from "@/components/menu/OrderStrip";
import { MenuSection } from "@/components/menu/MenuSection";
import { Toppings } from "@/components/menu/Toppings";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Smashed sliders, combos, Chris-Cut fries, tater tots, waffle fries, loaded fries, and shakes. All toppings at no extra charge.",
  alternates: { canonical: "/menu/" },
};

export default function MenuPage() {
  return (
    <div style={{ background: "var(--color-cne-cream)", paddingBottom: 80 }}>
      <MenuHero />
      <OrderStrip />
      <MenuSection category="sliders" />
      <MenuSection category="combos" />
      <MenuSection category="sides" />
      <MenuSection category="drinks" />
      <Toppings />
    </div>
  );
}
