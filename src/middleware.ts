import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/sessionToken";

/**
 * Protects `/admin/:path*` (everything except `/admin/sign-in`): no valid
 * `cne_owner` session cookie → redirect to sign-in with `next` set to the
 * page that was requested. Verified with `jose` directly (edge-compatible;
 * `src/lib/auth.ts` is Node-only via `server-only` and isn't importable
 * here).
 *
 * Also stamps every matched request with an `x-pathname` header (so
 * `requireOwner` in `src/lib/auth.ts` knows what to put in `next` for a
 * server component it can't call `usePathname` from) and every matched
 * response with `Cache-Control: private, no-store` — admin pages carry an
 * owner session and must never be cached, by a browser or by Vercel's edge.
 */
export const config = {
  matcher: ["/admin/:path*"],
};

const NO_STORE = "private, no-store";
const SIGN_IN_PATHS = new Set(["/admin/sign-in", "/admin/sign-in/"]);

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!secret || !token) return false;
  const session = await verifySessionToken(token, secret);
  return session !== null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!SIGN_IN_PATHS.has(pathname) && !(await hasValidSession(request))) {
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
