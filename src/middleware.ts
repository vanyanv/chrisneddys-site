import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Protects `/admin/:path*` (everything except `/admin/sign-in`): no
 * Better Auth session cookie present → redirect to sign-in with `next` set
 * to the page that was requested. `getSessionCookie` (edge-safe: no db, no
 * Node APIs, proven in `src/lib/betterAuth.spike.test.ts`'s A5) only checks
 * that a cookie of the right name is present — the real verification
 * happens server-side in `requireOwner()` (`src/lib/auth.ts`), which every
 * admin page or action calls before touching any data.
 *
 * Also exempts `/admin/forgot-password` and `/admin/reset-password` —
 * reachable signed out, same as `/admin/sign-in`, so an owner who's locked
 * out has a way back in. See
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`'s
 * "T3b" row.
 *
 * Also stamps every matched `/admin` request with an `x-pathname` header (so
 * `requireOwner` in `src/lib/auth.ts` knows what to put in `next` for a
 * server component it can't call `usePathname` from) and every matched
 * response with `Cache-Control: private, no-store` — admin pages carry an
 * owner session and must never be cached, by a browser or by Vercel's edge.
 *
 * `/shop/thanks` is matched too, auth-free: it renders a live order from
 * `?session_id=` alone (see `src/app/(site)/shop/thanks/page.tsx`), which
 * a Server Component has no way to mark `no-store` on its own response —
 * only Middleware and Route Handlers can set response headers — so this is
 * the one place that can stamp it, same reasoning as the admin pages above.
 */
export const config = {
  matcher: ["/admin/:path*", "/shop/thanks", "/shop/thanks/"],
};

const NO_STORE = "private, no-store";
const GUEST_PATHS = new Set([
  "/admin/sign-in",
  "/admin/sign-in/",
  "/admin/forgot-password",
  "/admin/forgot-password/",
  "/admin/reset-password",
  "/admin/reset-password/",
]);

function hasSessionCookie(request: NextRequest): boolean {
  return getSessionCookie(request) !== null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    // `/shop/thanks`: no session to check, just never let this response be
    // cached or reused across visitors.
    const response = NextResponse.next();
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  }

  if (!GUEST_PATHS.has(pathname) && !hasSessionCookie(request)) {
    const signInUrl = new URL("/admin/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(signInUrl, 307);
    redirectResponse.headers.set("Cache-Control", NO_STORE);
    return redirectResponse;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}
