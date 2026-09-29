import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { listOwners } from "@/lib/owners";
import { listPasskeysForEmail } from "@/lib/passkeys";
import { getSettingsForAdmin } from "@/lib/settingsAdmin";
import { isShopOpenFor, shopClosedReasons } from "@/lib/shopStatus";
import { SettingsForm } from "./SettingsForm";
import { ConnectionsCard } from "./ConnectionsCard";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { OwnersCard } from "./OwnersCard";
import { PasskeysCard } from "./PasskeysCard";
import "@/styles/admin-rack.css";
import "@/styles/admin-settings.css";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

/** The left-hand wayfinding column in `Settings.dc.html` — plain anchors
 * into the sections below rather than separate routes, since every field
 * here reads and writes the same one `store_settings` row (plus the
 * owner-account tables for the last two). The design draws only "The shop"
 * tab and marks it active; there's no scroll-spy here to move that
 * highlight as an owner scrolls, so it stays the default the design shows. */
const SETTINGS_NAV = [
  { href: "#settings-shop", label: "The shop" },
  { href: "#settings-shipping", label: "Shipping" },
  { href: "#settings-policies", label: "Policies" },
  { href: "#settings-connections", label: "Connections" },
  { href: "#settings-owners", label: "Owners" },
  { href: "#settings-signin", label: "Sign-in & passkeys" },
];

export default async function AdminSettingsPage() {
  const session = await requireOwner();
  // `getSettingsForAdmin()` already reads the same `store_settings` row
  // `isShopOpenFor` needs — a separate `getStoreSettings()` call here would
  // just be the identical query run twice against PGlite's one serialized
  // connection (issue #38).
  const [settings, owners, passkeys] = await Promise.all([
    getSettingsForAdmin(),
    listOwners(session.email),
    listPasskeysForEmail(session.email),
  ]);

  const shopOpen = isShopOpenFor(settings);
  const closedReasons = shopClosedReasons(settings);
  const initials = ownerInitials(session);

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
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rack-tab"
              aria-current={item.href === "/admin/settings" ? "page" : undefined}
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
            <summary className="rack-avatar">{initials}</summary>
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

      <div className="rack-settings-body">
        <nav className="rack-settings-nav" aria-label="Settings sections">
          {SETTINGS_NAV.map((item, i) => (
            <a key={item.href} href={item.href} className={i === 0 ? "is-active" : ""}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="rack-settings-content">
          <SettingsForm
            settings={settings}
            shopOpen={shopOpen}
            closedReasons={closedReasons}
            connections={<ConnectionsCard />}
            changePassword={<ChangePasswordCard />}
            passkeys={<PasskeysCard passkeys={passkeys} />}
            owners={<OwnersCard owners={owners} />}
          />
        </div>
      </div>
    </div>
  );
}
