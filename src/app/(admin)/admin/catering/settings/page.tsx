import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getCateringSettings } from "@/lib/catering/settings";
import { CateringNavBadge } from "../CateringNavBadge";
import { CateringPill } from "../CateringPill";
import { CateringSettingsSection } from "../CateringSettingsSection";
import { getCateringNeedsYouCount } from "../navCount";
import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";
import "@/styles/admin-settings.css";
import "@/styles/admin-catering.css";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/catering", label: "Catering" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * `/admin/catering/settings/` — catering's own settings, reached from the
 * Catering tab. Deliberately not part of the shop's `/admin/settings`:
 * catering and the shop are switched on and off separately.
 */
export default async function AdminCateringSettingsPage() {
  const session = await requireOwner();
  const [settings, cateringCount] = await Promise.all([
    getCateringSettings(),
    getCateringNeedsYouCount(),
  ]);
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
              aria-current={item.href === "/admin/catering" ? "page" : undefined}
            >
              {item.label}
              {item.href === "/admin/catering" && <CateringNavBadge count={cateringCount} />}
            </Link>
          ))}
        </div>
        <div className="rack-top-right">
          <CateringPill on={settings.orderingOn} />
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

      <div style={{ padding: "18px 22px 0" }}>
        <Link href="/admin/catering" className="ord-back-link">
          <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          All catering
        </Link>
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div>
          <h1 className="rack-page-title rack-bow" style={{ fontSize: 32 }}>
            Catering settings
          </h1>
          <p className="adm-settings-lede">
            What catering customers can pick online. The shop has its own settings.
          </p>
        </div>
      </div>

      {/* Bottom padding clears the fixed save bar so the last field is never
          hidden behind it on a phone. */}
      <div style={{ padding: "0 22px 96px" }}>
        <CateringSettingsSection settings={settings} />
      </div>
    </div>
  );
}
