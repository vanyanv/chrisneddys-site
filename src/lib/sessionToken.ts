/**
 * The owner-session JWT: sign/verify only, no cookies, no Next APIs. Kept
 * edge-compatible (just `jose` + Web Crypto) so both `src/lib/auth.ts`
 * (Node runtime, server components/actions) and `src/middleware.ts` (edge
 * runtime) verify the exact same token the exact same way.
 */
import { SignJWT, jwtVerify } from "jose";

export type OwnerSession = { email: string; name: string | null; issuedAt: number };

const ALG = "HS256";

/** The owner-session cookie. httpOnly, secure in production, sameSite lax, path /. */
export const SESSION_COOKIE_NAME = "cne_owner";
/** 30 days, in seconds — the cookie's maxAge and the JWT's lifetime. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  session: { email: string; name: string | null },
  secret: string,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: session.email, name: session.name })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(secretKey(secret));
}

/** Returns null for a missing/invalid/expired token rather than throwing. */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<OwnerSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: [ALG] });
    if (typeof payload.email !== "string" || typeof payload.iat !== "number") return null;
    const name = typeof payload.name === "string" ? payload.name : null;
    return { email: payload.email, name, issuedAt: payload.iat };
  } catch {
    return null;
  }
}
