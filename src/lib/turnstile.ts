import "server-only";

/**
 * Cloudflare Turnstile on the contact form: a mostly invisible "are you
 * human" check. OFF until both keys are set in Vercel —
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the browser half, baked in at build, so
 * a redeploy is needed after setting it) and `TURNSTILE_SECRET_KEY` (the
 * server half). With either missing the form shows no widget and the server
 * checks nothing, so a half-done setup can't lock real people out.
 *
 * See DEPLOY.md, "Contact form spam".
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

/**
 * True when Cloudflare says the token is good, or when Cloudflare can't be
 * reached (fail open, like the send throttle: an outage on their side must
 * not eat a real message). False for a missing, reused or forged token.
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY ?? "",
    response: token,
  });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[site-form] Turnstile check failed; letting the message through", err);
    return true;
  }
}
