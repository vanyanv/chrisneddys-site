import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getCateringSettings } from "@/lib/catering/settings";
import { renderCateringEmailPreviews } from "@/lib/catering/emails";
import { CateringNavBadge } from "../CateringNavBadge";
import { CateringPill } from "../CateringPill";
import { SendTestEmails } from "./SendTestEmails";
import { getCateringNeedsYouCount } from "../navCount";
import "@/styles/admin-rack.css";
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
 * `/admin/catering/emails/` — every catering email rendered against a
 * sample order, for the owner to OK before ordering goes live (customer
 * emails are drafts until then — see `docs/catering-build-plan.md`'s
 * "Emails" ground rule). Each preview renders in a sandboxed `<iframe
 * srcdoc>` rather than injected into the page: the HTML is our own
 * template output, but it's still full email markup (`<html>`/`<body>` of
 * its own), not a fragment meant to share this page's styles or scripts.
 */
export default async function AdminCateringEmailsPage() {
  const session = await requireOwner();
  const [cateringSettings, cateringCount] = await Promise.all([
    getCateringSettings(),
    getCateringNeedsYouCount(),
  ]);
  const previews = renderCateringEmailPreviews();

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
          <CateringPill on={cateringSettings.orderingOn} />
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
            Catering emails
          </h1>
          <p className="adm-settings-lede">
            Every catering email, rendered against a sample order — OK the copy before turning
            ordering on.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 22px 18px" }}>
        <SendTestEmails ownerEmail={cateringSettings.ownerEmail} />
      </div>

      <div style={{ padding: "0 22px 40px" }}>
        <div className="cat-email-list">
          {previews.map((preview) => (
            <div key={preview.id} className="cat-email-card">
              <div className="cat-email-card-head">
                <div>
                  <div className="cat-email-subject">{preview.content.subject}</div>
                  <div className="cat-email-key">{preview.label}</div>
                </div>
              </div>
              <iframe
                className="cat-email-frame"
                title={preview.label}
                srcDoc={preview.content.html}
                sandbox=""
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
