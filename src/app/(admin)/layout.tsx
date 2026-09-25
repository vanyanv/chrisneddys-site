import type { Metadata } from "next";
import { bowlby, inter, jetbrains } from "@/lib/fonts";
import "@/styles/admin.css";
import { OfflineIndicator } from "@/app/(admin)/admin/OfflineIndicator";

export const metadata: Metadata = {
  title: "Store admin — Chris N Eddy's",
  robots: { index: false, follow: false },
};

/**
 * `/admin`'s own root layout — a second, separate root from the storefront's
 * (`src/app/(site)/layout.tsx`), split by route group rather than by
 * branching one layout on the request path. No `SiteHeader`, tab strip,
 * footer, `BagDrawer`, `OrderDock`, or analytics scripts belong here: this
 * is a different product sharing the same Next app. The actual admin chrome
 * (top bar, sidebar nav, sign-in redirect) lives in the nested
 * `src/app/(admin)/admin/layout.tsx`, which needs `requireOwner()`'s
 * `x-pathname` read and so stays a regular (non-root) layout.
 *
 * `OfflineIndicator` (issue #36 phase 5, "When it breaks") is mounted here
 * rather than in any one page's shell, so it shows up over every `/admin`
 * route — signed in or not, including sign-in itself.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bowlby.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        {children}
        <OfflineIndicator />
      </body>
    </html>
  );
}
