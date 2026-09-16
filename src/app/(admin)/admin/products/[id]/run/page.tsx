import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getRunForAdmin } from "@/lib/runAdmin";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import { RunBoard } from "./RunBoard";
import "@/styles/admin-rack.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * `/admin/products/[id]/run` — "All fifty numbers" (issue #36 phase 3).
 * Every number in a numbered run, who owns it, and what's held in an open
 * checkout right now. Read-only: no recovery email, no nudge button
 * anywhere here — a hold lapses on its own and the number goes back on the
 * shelf with nobody notified (issue #36's decisions comment). Own shell,
 * same as every other signed-in admin route now that `admin/layout.tsx`
 * draws none itself.
 */
export default async function AdminRunPage({ params }: { params: Promise<Params> }) {
  const session = await requireOwner();
  const { id } = await params;

  const [run, settings] = await Promise.all([getRunForAdmin(id), getStoreSettings()]);
  if (!run) notFound();

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

      <div style={{ padding: "18px 22px 0" }}>
        <Link href={`/admin/products/${run.productId}`} className="ord-back-link">
          <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          {run.productTitle || "This product"}
        </Link>
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 13, flexWrap: "wrap" }}>
          <h1 className="rack-page-title rack-bow" style={{ fontSize: 40 }}>
            The run
          </h1>
          <span className="rack-page-count rack-mono">
            {run.productEyebrow ? `${run.productEyebrow.toUpperCase()} · ` : ""}
            {run.editionSize} MADE &middot; {run.locked ? "LOCKED" : "OPEN"}
          </span>
        </div>
      </div>

      <RunBoard run={run} serverNow={Date.now()} />
    </div>
  );
}
