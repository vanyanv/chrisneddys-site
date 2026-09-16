import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/layout";
import { listArchivedProductsForAdmin, listProductsForAdmin } from "@/lib/catalogAdmin";
import { getStoreSettings } from "@/lib/orders";
import { getSetupChecklist } from "@/lib/setupChecklist";
import { isShopOpenFor } from "@/lib/shopStatus";
import { RackCatalogue } from "./RackCatalogue";
import { RackEmptyState } from "./RackEmptyState";
import "@/styles/admin-rack.css";

export const dynamic = "force-dynamic";

/** `/admin/products` — The Rack's catalogue (issue #36 phase 2). Owns its
 * own shell (top bar, tabs, avatar menu) exactly like `/admin`'s Today
 * (`src/app/(admin)/admin/page.tsx`) does, rather than the Sheet chrome
 * `admin/layout.tsx` still gives Orders and Settings — `admin/layout.tsx`
 * special-cases this path the same way it already does for `/admin`. */
const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const session = await requireOwner();
  const { open } = await searchParams;

  const [allRows, archived, settings] = await Promise.all([
    listProductsForAdmin(),
    listArchivedProductsForAdmin(),
    getStoreSettings(),
  ]);
  // `listProductsForAdmin` returns every status, archived included — archived
  // products only belong in the "Archived (n)" disclosure, never the grid.
  const rows = allRows.filter((row) => row.status !== "archived");

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);
  const isEmpty = rows.length === 0 && archived.length === 0;

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
              aria-current={item.href === "/admin/products" ? "page" : undefined}
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

      {isEmpty ? (
        <RackEmptyState checklist={getSetupChecklist()} />
      ) : (
        <RackCatalogue
          rows={rows}
          archived={archived}
          blobConfigured={blobConfigured}
          openId={open ?? null}
        />
      )}
    </div>
  );
}
