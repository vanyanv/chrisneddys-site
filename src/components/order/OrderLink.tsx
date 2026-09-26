"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { Location } from "@/data/locations";
import type { MenuItem } from "@/data/menu";
import type { OrderSurface } from "@/lib/otter";
import { slugFor } from "@/lib/locationSlug";
import { openOrderPicker, orderTargetUrl, useOrderChoice } from "@/lib/orderChoice";

/**
 * An ORDER button that knows there is more than one store (issue #178).
 *
 * Once the visitor has picked a store (or when only one is open) it is a plain
 * link to that store's ordering page, opening in a new tab like every order
 * link on the site. Before they have picked, a tap opens the "Which
 * location?" panel instead. Without JavaScript it links to /order/, where
 * each store has its own button.
 *
 * `children` can be a function of the store the link goes to, for a label
 * that names it.
 */
export function OrderLink({
  surface,
  item,
  className,
  style,
  children,
}: {
  surface: OrderSurface;
  item?: Pick<MenuItem, "id" | "name" | "otterId">;
  className?: string;
  style?: CSSProperties;
  children: ReactNode | ((loc: Location | null) => ReactNode);
}) {
  const chosen = useOrderChoice();
  const content = typeof children === "function" ? children(chosen) : children;

  if (chosen) {
    return (
      <a
        className={className}
        style={style}
        href={orderTargetUrl(chosen, surface, item)}
        data-surface={surface}
        data-item={item?.id}
        data-location={slugFor(chosen)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // A modified click still gets the /order/ page in a new tab, as asked.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openOrderPicker({ surface, item });
  };

  return (
    <a
      className={className}
      style={style}
      href="/order/"
      data-surface={surface}
      data-item={item?.id}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {content}
    </a>
  );
}
