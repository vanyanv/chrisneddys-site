"use client";

import { useEffect } from "react";
import type { MerchProduct } from "@/data/merch";
import { track, type TrackItem } from "@/lib/track";

const LIST_ID = "shop_index";
const LIST_NAME = "Shop";

/** GA4's ecommerce line item, from a product — same shape `ProductBuy.tsx`
 * builds for `view_item`/`add_to_cart`, minus the quantity a listing has no
 * notion of yet (defaulted to 1, same as an empty cart line would be). */
function lineItem(product: MerchProduct): TrackItem {
  return { item_id: product.slug, item_name: product.name, price: product.price, quantity: 1 };
}

/**
 * Fires `view_item_list` once for the shop index, and `select_item` when a
 * card in it is tapped.
 *
 * The index itself is a server component (`shop/page.tsx`) that renders each
 * product's card markup — flags, inventory bar, edition copy — inline, so
 * pulling that into a client-side card component just to attach a click
 * handler would move real markup across the server/client boundary for no
 * reason. A delegated handler on the grid wrapper does not: the page keeps
 * rendering the cards, and this component only ever sees which one was
 * clicked, via `data-slug` on each `<Link>`.
 */
export function ShopIndexTracking({
  products,
  children,
}: {
  products: MerchProduct[];
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (products.length === 0) return;
    track("view_item_list", {
      item_list_id: LIST_ID,
      item_list_name: LIST_NAME,
      items: products.map(lineItem),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-slug]");
    const slug = card?.dataset.slug;
    if (!slug) return;
    const product = products.find((p) => p.slug === slug);
    if (!product) return;
    track("select_item", {
      item_list_id: LIST_ID,
      item_list_name: LIST_NAME,
      items: [lineItem(product)],
    });
  };

  return (
    <div className="cne-drops" onClick={onClick}>
      {children}
    </div>
  );
}
