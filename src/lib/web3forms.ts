import { brand } from "@/data/brand";

/**
 * Web3Forms — the only place a static export can send a POST.
 *
 * Shared by the contact form (`GuestCheck.tsx`) and the opening-list signup
 * (`OpeningNotify.tsx`): same endpoint, same public access key, same
 * success/failure shape. Each caller still owns its own fields, its own
 * `!ACCESS_KEY` early-exit copy, and its own `track()` calls — those differ by
 * form, so they stay put. This module is only the part that was byte-for-byte
 * identical between the two.
 */

export const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

const ACCESS_KEY = process.env.NEXT_PUBLIC_W3F_KEY ?? "";

/** Whether a key was baked into this build at all. */
export function hasWeb3FormsKey(): boolean {
  return ACCESS_KEY !== "";
}

/**
 * Carries the status code out of the `try` so the failure event can say
 * whether Web3Forms rejected the request or the network never reached it.
 * The provider's own message is deliberately not carried: it is free text
 * from a third party and has no business becoming a GA4 dimension.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    /** True when Web3Forms answered 200 but its own body said `success: false`. */
    readonly rejected: boolean,
  ) {
    super(`HTTP ${status}`);
  }
}

/**
 * Deliberately permissive: the only thing worth rejecting in the browser is an
 * address that cannot be delivered to at all. Anything stricter turns real
 * addresses (plus-tags, new TLDs, unicode locals) into a form that will not
 * submit, and the server checks it properly either way.
 */
export function emailLooksSendable(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * POSTs `fields` to Web3Forms as JSON and throws `HttpError` unless it comes
 * back 200 with `success: true`. `access_key` and `from_name` are filled in
 * here since both callers send the same values; anything else — `subject`,
 * `replyto`, `botcheck`, the form's own data — is the caller's to pass.
 */
export async function submitWeb3Form(fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(WEB3FORMS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: ACCESS_KEY,
      from_name: `${brand.name} website`,
      ...fields,
    }),
  });

  const body: { success?: boolean } = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new HttpError(res.status, res.ok);
}
