import type { OwnerSession } from "@/lib/auth";

/**
 * "CE" from a name ("Chris Eddy" -> "CE"), or the first two letters of the
 * email's local part when there's no name on file — every owner session has
 * an email, not every one has a name. Used by every page that owns its own
 * `rack-topbar` (Today, Products, Orders, the order detail page, Settings)
 * to build the same initials for its own avatar without duplicating this
 * logic.
 *
 * Lives in its own module rather than `admin/layout.tsx` (where it used to
 * live, through issue #36 phase 3): a `layout.tsx` may only export its
 * default component plus Next's own small set of special exports
 * (`metadata`, `generateStaticParams`, `dynamic`, …) — `next build`'s route
 * type-checking rejects anything else as an invalid Layout export field.
 * That went unnoticed while this function was also *called* from inside
 * `admin/layout.tsx` itself; phase 4 removes that layout's last render
 * path that needed it, which is what surfaces the error, so it moves here.
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
