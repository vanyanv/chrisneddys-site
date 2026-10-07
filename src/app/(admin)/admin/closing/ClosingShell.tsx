import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ADMIN_NAV } from "@/app/(admin)/admin/adminNav";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import type { OwnerSession } from "@/lib/auth";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import "@/styles/admin-rack.css";
import "@/styles/admin-closing.css";

export type ClosingTab = "nights" | "items" | "crew";

const TABS: { key: ClosingTab; href: string; label: string }[] = [
  { key: "nights", href: "/admin/closing", label: "Nights" },
  { key: "items", href: "/admin/closing/items", label: "Edit the list" },
  { key: "crew", href: "/admin/closing/crew", label: "QR & crew codes" },
];

/** The Rack top bar, the "Closing" title and the Nights / Edit the list /
 * QR & crew codes switcher shared by the three closing pages. The page calls
 * `requireOwner()` first and hands the session in. */
export async function ClosingShell({
  session,
  active,
  children,
}: {
  session: OwnerSession;
  active: ClosingTab;
  children: ReactNode;
}) {
  const shopOpen = isShopOpenFor(await getStoreSettings());
  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <Link href="/admin" className="rack-brand">
          <Image
            src="/cne-logo-2x.webp"
            alt="Chris N Eddy's"
            width={309}
            height={87}
            className="rack-logo"
            priority
          />
          <span className="rack-wordmark-tag rack-mono">STORE</span>
        </Link>
        <div className="rack-tabs">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rack-tab"
              aria-current={item.href === "/admin/closing" ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="rack-top-right">
          <span className={`rack-store-pill rack-mono ${shopOpen ? "" : "is-closed"}`}>
            <i></i>Store: {shopOpen ? "Open" : "Closed"}
          </span>
          <details className="rack-avatar-menu">
            <summary className="rack-avatar">{ownerInitials(session)}</summary>
            <div className="rack-menu">
              <p className="rack-menu-email">{session.email}</p>
              <form action={signOutAction}>
                <button type="submit" className="rack-menu-signout">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </nav>

      <div className="rack-page-header">
        <div>
          <span className="rack-eyebrow">Van Nuys</span>
          <h1 className="rack-page-title rack-bow">Closing</h1>
        </div>
      </div>

      <div className="clo-body">
        <nav className="clo-subnav" aria-label="Closing sections">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href + "/"}
              className="clo-subtab"
              aria-current={t.key === active ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
