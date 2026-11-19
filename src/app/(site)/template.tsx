"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Page-to-page cross-fade. Keyed by the full pathname, so every in-site
 * navigation (including /menu/ to /menu/<item>/, which keeps this template
 * mounted) swaps the boundary and fires its enter and exit: the browser fades
 * the old page into the new one (`.cne-page` in motion.css). `default="none"`
 * keeps it still for everything that isn't a navigation (popups, the bag,
 * query-string changes). It renders no DOM, so a page at rest is unchanged; the
 * first load runs no transition (the welcome intro is untouched), and browsers
 * without view transitions swap pages exactly as before.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="cne-page" exit="cne-page" default="none">
      {children}
    </ViewTransition>
  );
}
