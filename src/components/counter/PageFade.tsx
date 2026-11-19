import { ViewTransition } from "react";

/**
 * Page-to-page cross-fade. Rendered by the templates in src/app/(site): a
 * template (unlike a layout) mounts afresh whenever its child segment changes,
 * so this boundary's enter and exit fire on each in-site click and the browser
 * fades the old page into the new one (`.cne-page` in motion.css). The (site)
 * template covers top-level moves; menu/, locations/ and shop/ each have their
 * own so /menu/ to /menu/<item>/ fades too (React runs only the outermost
 * boundary that enters or exits, so nesting never doubles the fade).
 * `default="none"` keeps it still for everything that isn't a navigation
 * (popups, the bag, query-string changes). It renders no DOM and ships no
 * client JavaScript; the first load runs no transition (the welcome intro is
 * untouched), and browsers without view transitions swap pages as before.
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="cne-page" exit="cne-page" default="none">
      {children}
    </ViewTransition>
  );
}
