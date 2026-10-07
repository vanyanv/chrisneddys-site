import type { Metadata } from "next";
import { cookies } from "next/headers";
import { bowlby, inter } from "@/lib/fonts";
import { LANG_COOKIE, parseLang } from "@/lib/closing/crewText";
import "@/styles/closing.css";

export const metadata: Metadata = {
  title: "Closing check",
  robots: { index: false, follow: false },
};

/**
 * The crew's closing checklist (`/close/[token]`) is its own root layout, like
 * `(admin)`: no storefront header, footer or analytics. It reads the language
 * cookie so `<html lang>` matches what the crew chose, which also makes every
 * page here dynamic, as it has to be (cookies and the server clock).
 */
export default async function CrewRootLayout({ children }: { children: React.ReactNode }) {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <html lang={lang} className={`${bowlby.variable} ${inter.variable}`}>
      <body className="cl-body">
        <div className="cl-app">{children}</div>
      </body>
    </html>
  );
}
