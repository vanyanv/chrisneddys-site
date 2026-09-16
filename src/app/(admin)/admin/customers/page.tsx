import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { listCustomersForAdmin } from "@/lib/customersAdmin";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import { CustomersTable, type CustomersTableRow } from "./CustomersTable";
import "@/styles/admin-rack.css";
import "@/styles/admin-customers.css";

export const dynamic = "force-dynamic";

/**
 * `/admin/customers` — "Everyone who's bought" (issue #36 phase 7). A
 * customer here is a projection over `orders` grouped by normalized email,
 * not a stored row — see `src/lib/customersAdmin.ts` for the full reasoning
 * and the identity-key caveat. Own shell, same convention as every other
 * signed-in admin route now that `admin/layout.tsx` draws none itself.
 */
const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminCustomersPage() {
  const session = await requireOwner();
  const [customers, settings] = await Promise.all([listCustomersForAdmin(), getStoreSettings()]);

  const rows: CustomersTableRow[] = customers.map((c) => ({
    key: c.key,
    email: c.email,
    name: c.name,
    orderCount: c.orderCount,
    totalSpentCents: c.totalSpentCents,
    firstOrderAt: c.firstOrderAt ? c.firstOrderAt.toISOString() : null,
    refundedCount: c.refundedCount,
  }));

  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);

  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <Link href="/admin" className="rack-brand">
          <Image
            src="/cne-logo.webp"
            alt="Chris N Eddy's"
            width={309}
            height={89}
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
              aria-current={item.href === "/admin/customers" ? "page" : undefined}
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

      <div className="rack-page-header">
        <div>
          <h1 className="rack-page-title rack-bow">Customers</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-page-count rack-mono">
            {rows.length} customer{rows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div style={{ padding: "0 22px 22px" }}>
        {rows.length === 0 ? (
          <p className="adm-empty">
            No customers yet. They show up here once an order is paid — a name and email with
            nothing behind it yet is just a checkout in progress.
          </p>
        ) : (
          <CustomersTable rows={rows} />
        )}
      </div>
    </div>
  );
}
