import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import "@/styles/admin.css";
import { getOwnerSession, requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Store admin — Chris N Eddy's",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
];

/** Strips the trailing slash `trailingSlash: true` adds, except for "/". */
function normalizePathname(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

const SIGN_IN_PATH = "/admin/sign-in";

/**
 * Minimal chrome, distinct from the storefront: an ink top bar and a
 * sidebar nav (a top row on phones), styled from `src/styles/admin.css`.
 * The sign-in page shares this route tree but isn't signed in yet, so it
 * gets the bare shell with no top bar or nav — just its own centred card.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = normalizePathname(headerList.get("x-pathname") ?? "");
  const isSignIn = pathname === SIGN_IN_PATH;

  const session = isSignIn ? await getOwnerSession() : await requireOwner();

  if (!session) {
    return <div className="adm-shell adm-shell-guest">{children}</div>;
  }

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-topbar-inner">
          <Link href="/admin" className="adm-brand">
            <Image src="/cne-logo.webp" alt="Chris N Eddy's" width={120} height={35} priority />
            <span className="adm-store-label">STORE</span>
          </Link>
          <div className="adm-topbar-right">
            <span className="adm-email-chip">{session.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="adm-btn adm-btn-danger">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="adm-body">
        <nav className="adm-sidebar" aria-label="Admin sections">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === normalizePathname(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="adm-main">{children}</main>
      </div>
    </div>
  );
}
