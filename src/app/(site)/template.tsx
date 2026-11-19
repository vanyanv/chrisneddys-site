import { ViewTransition } from "react";

/**
 * Page-to-page cross-fade. A template (unlike the layout) mounts afresh on
 * every navigation, so this `<ViewTransition>`'s enter and exit fire on each
 * in-site click and the browser fades the old page into the new one
 * (`.cne-page` in motion.css). `default="none"` keeps it still for everything
 * that isn't a navigation. It renders no DOM, so a page at rest is unchanged;
 * the first load runs no transition (the welcome intro is untouched), and
 * browsers without view transitions swap pages exactly as before.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="cne-page" exit="cne-page" default="none">
      {children}
    </ViewTransition>
  );
}
