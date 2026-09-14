import type { Metadata } from "next";
import { Bowlby_One, Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/admin.css";

const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  display: "optional",
  variable: "--font-bowlby",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "optional",
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "optional",
  variable: "--font-mono-jb",
});

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
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bowlby.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
