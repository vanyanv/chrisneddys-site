import { headers } from "next/headers";
import { getOwnerSession, requireOwner } from "@/lib/auth";

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
 * The auth gate for every `/admin*` route. Through issue #36 phase 3, this
 * layout drew the Sheet's own ink top bar (`adm-topbar`/`adm-shell`, from
 * `admin.css`) for every signed-in route except `/admin` and
 * `/admin/products`, which had already moved onto The Rack and drew their
 * own `rack-topbar` shell instead (`src/styles/admin-rack.css`). Phase 4
 * moves Orders, the order detail page, the packing slip, and Settings onto
 * the same pattern — Orders and Settings now draw their own `rack-topbar`
 * the same way Today and Products do, and the packing slip deliberately
 * draws none at all, since it's a print sheet, not a screen with
 * navigation. That was every route the Sheet's shell still served, so this
 * layout no longer renders any shell for a signed-in owner at all — only
 * the bare guest shell for the sign-in/forgot-password/reset-password
 * pages, which were never on The Rack and never had a top bar.
 *
 * `ownerInitials` used to live here too, called from the shell this layout
 * rendered. It's moved to `./ownerDisplay.ts` now that this function has no
 * render path left to call it from: `next build`'s route type-checking
 * rejects any `layout.tsx` export beyond `default` and Next's own small
 * reserved set ("... is not a valid Layout export field") — a real, latent
 * rule this file happened to slip past while its old body both exported
 * *and called* `ownerInitials` internally in one large render path;
 * shrinking that body down to just the auth gate is what turns the
 * pre-existing violation into a build failure. Every caller of
 * `ownerInitials` (Today, Products, Orders, the order detail page,
 * Settings) now imports it from `./ownerDisplay` instead — a one-line,
 * behavior-preserving import-path change, including in
 * `admin/products/page.tsx`, which this phase otherwise leaves alone.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = normalizePathname(headerList.get("x-pathname") ?? "");
  const isGuestPath = GUEST_PATHS.has(pathname);

  const session = isGuestPath ? await getOwnerSession() : await requireOwner();

  if (!session) {
    return <div className="adm-shell adm-shell-guest">{children}</div>;
  }

  return <>{children}</>;
}
