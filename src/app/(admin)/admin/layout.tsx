import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { getOwnerSession, requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import type { OwnerSession } from "@/lib/auth";

const NAV = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
];

/** Strips the trailing slash `trailingSlash: true` adds, except for "/". */
function normalizePathname(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Routes reachable signed out — the sign-in page itself, plus the two
 * password-recovery pages (`src/app/(admin)/admin/forgot-password`,
 * `src/app/(admin)/admin/reset-password`). Everything else falls through to
 * `requireOwner()` below. `src/middleware.ts` exempts the same three paths
 * from its own cookie-presence check; this is the second, server-side half
 * of that — without it `requireOwner()` would redirect a signed-out visitor
 * away from these pages regardless of what middleware let through. */
const GUEST_PATHS = new Set(["/admin/sign-in", "/admin/forgot-password", "/admin/reset-password"]);

/**
 * "CE" from a name ("Chris Eddy" -> "CE"), or the first two letters of the
 * email's local part when there's no name on file — every owner session has
 * an email, not every one has a name. Exported so `/admin`'s own page
 * (`admin/page.tsx`, The Rack) can build the same initials for its own
 * avatar without duplicating this logic — see the note below on why that
 * page owns its chrome instead of using this layout's.
 */
export function ownerInitials(session: OwnerSession): string {
  if (session.name) {
    const letters = session.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("");
    if (letters) return letters.toUpperCase();
  }
  return session.email.slice(0, 2).toUpperCase();
}

/**
 * The Sheet's chrome: an ink top bar (wordmark, section tabs, store-open
 * pill, owner menu) and nothing else — no sidebar. `/admin/products` is the
 * home the tabs point at. The sign-in page shares this route tree but isn't
 * signed in yet, so it gets the bare guest shell with no top bar — just its
 * own centred card.
 *
 * `/admin` itself is `Today` (The Rack, issue #36) rather than a redirect
 * to `/admin/products` — it's the one page this phase moves onto The
 * Rack's visual system, which has its own top bar/tabs (`rack-topbar` in
 * `src/styles/admin-rack.css`), not this one's `adm-topbar`. So this layout
 * only does the auth gate for it and hands back `children` untouched.
 *
 * Phase 2 (issue #36) moves `/admin/products` itself onto The Rack the same
 * way — its `page.tsx` and `loading.tsx` own their own `rack-topbar` shell
 * now, same reasoning as Today. `/admin/products/<id>`, the standalone full
 * editor, is deliberately NOT included in that check: it isn't part of this
 * phase's artboards and still renders inside the Sheet chrome below, on the
 * unchanged `ProductEditor`/`PhotosEditor`. Orders and Settings are
 * untouched either way.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = normalizePathname(headerList.get("x-pathname") ?? "");
  const isGuestPath = GUEST_PATHS.has(pathname);

  const session = isGuestPath ? await getOwnerSession() : await requireOwner();

  if (!session) {
    return <div className="adm-shell adm-shell-guest">{children}</div>;
  }

  if (pathname === "/admin" || pathname === "/admin/products") {
    return <>{children}</>;
  }

  const settings = await getStoreSettings();
  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-topbar-inner">
          <Link href="/admin/products" className="adm-brand">
            <Image
              src="/cne-logo.webp"
              alt="Chris N Eddy's"
              width={309}
              height={89}
              className="adm-logo"
              priority
            />
            <span className="adm-store-label">STORE</span>
          </Link>

          <nav className="adm-nav-tabs" aria-label="Admin sections">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="adm-nav-tab"
                aria-current={pathname === normalizePathname(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="adm-topbar-right">
            <span className={`adm-pill ${shopOpen ? "is-open" : "is-closed"}`}>
              Store: {shopOpen ? "Open" : "Closed"}
            </span>
            <details className="adm-menu-wrap adm-avatar-menu">
              <summary className="adm-avatar">{initials}</summary>
              <div className="adm-menu">
                <p className="adm-menu-email">{session.email}</p>
                <form action={signOutAction}>
                  <button type="submit" className="adm-menu-signout">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="adm-main">{children}</main>
    </div>
  );
}
