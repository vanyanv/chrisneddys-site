/**
 * The private, server-to-server door into the shop admin: every route under
 * `src/app/api/internal/shop/` is wrapped in `withInternalAuth`, which is the
 * only way those routes reach the "AsSystem" mutations (which skip
 * `requireOwner()` because there is no owner session on a server call).
 *
 * ## What the caller (the restaurant dashboard) must replicate
 *
 * Set the same `SHOP_INTERNAL_API_SECRET` (32+ characters) on both apps, and
 * send two headers with every request:
 *
 * - `x-shop-timestamp`: unix milliseconds now.
 * - `x-shop-signature`: lowercase hex HMAC-SHA256, keyed with the secret, of
 *   the string `${timestamp}.${METHOD}.${pathnameWithSearch}.${rawBody}`
 *   where METHOD is upper-case, `pathnameWithSearch` is the URL path plus
 *   `?query` when there is one (`/api/internal/shop/orders?filter=open`) and
 *   `rawBody` is the exact request body string (`""` for a GET).
 *   `signInternalRequest` below is that computation.
 *
 * A request more than five minutes off this server's clock, with a missing
 * header or with a signature that does not match is a 401. With the secret
 * unset or shorter than 32 characters every route is a 503 — the door is
 * shut, not open. Replays inside the window are possible; every route is
 * either a read or a transition the order state machine refuses to repeat.
 *
 * Responses are always `Cache-Control: private, no-store`, dates are ISO
 * strings (plain `JSON.stringify`), money is integer cents.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;
const MAX_SKEW_MS = 5 * 60 * 1000;

export type InternalApiError = { ok: false; error: string };

/** A JSON response with the headers every internal route carries. */
export function internalJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

export function internalError(error: string, status = 400): Response {
  const body: InternalApiError = { ok: false, error };
  return internalJson(body, status);
}

/** The signature the dashboard must send. `now` is the timestamp in unix ms
 * that goes in `x-shop-timestamp`. */
export function signInternalRequest(
  secret: string,
  method: string,
  pathWithSearch: string,
  body: string,
  now: number,
): { timestamp: string; signature: string } {
  const timestamp = String(now);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${method.toUpperCase()}.${pathWithSearch}.${body}`)
    .digest("hex");
  return { timestamp, signature };
}

function configuredSecret(): string | null {
  const secret = process.env.SHOP_INTERNAL_API_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function signatureMatches(expectedHex: string, givenHex: string): boolean {
  const expected = Buffer.from(expectedHex, "utf8");
  const given = Buffer.from(givenHex, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type InternalContext<P> = { rawBody: string; params: P };

/**
 * Wraps a route handler: checks the signature, then calls
 * `handler(request, { rawBody, params })`. The body is read once here (it has
 * to be, to verify it) and handed on as text. An exception from the handler
 * becomes a 500 `{ok:false,error}` rather than a stack trace.
 */
export function withInternalAuth<P = Record<string, never>>(
  handler: (request: Request, ctx: InternalContext<P>) => Promise<Response>,
): (request: Request, routeCtx: { params: Promise<P> }) => Promise<Response> {
  return async (request, routeCtx) => {
    const secret = configuredSecret();
    if (!secret) return internalError("Internal API not configured", 503);

    const timestamp = request.headers.get("x-shop-timestamp");
    const signature = request.headers.get("x-shop-signature");
    if (!timestamp || !signature || !/^\d{1,16}$/.test(timestamp)) {
      return internalError("Unauthorized", 401);
    }
    if (Math.abs(Date.now() - Number(timestamp)) > MAX_SKEW_MS) {
      return internalError("Unauthorized", 401);
    }

    const url = new URL(request.url);
    const rawBody =
      request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
    const expected = signInternalRequest(
      secret,
      request.method,
      `${url.pathname}${url.search}`,
      rawBody,
      Number(timestamp),
    ).signature;
    if (!signatureMatches(expected, signature.toLowerCase())) {
      return internalError("Unauthorized", 401);
    }

    try {
      const params = await (routeCtx?.params ?? Promise.resolve({} as P));
      return await handler(request, { rawBody, params });
    } catch (error) {
      console.error("internal shop api error", error);
      return internalError("Internal error", 500);
    }
  };
}

/** Parses a JSON object body. `null` when it is not valid JSON or not a
 * plain object; an empty body counts as `{}` when `allowEmpty`. */
export function parseJsonObject(
  rawBody: string,
  allowEmpty = false,
): Record<string, unknown> | null {
  if (rawBody.trim() === "") return allowEmpty ? {} : null;
  try {
    const value: unknown = JSON.parse(rawBody);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
