"use server";

/**
 * Server actions behind the site's two public forms: the contact form on
 * `/contact/` and the "Know when {hood} opens" signup on the locations that
 * haven't opened yet. Both email the address the site itself shows
 * (`brand.email`), through the same Resend sender as the order emails
 * (`sendEmail` in `src/lib/email.ts`, gated on `RESEND_API_KEY` +
 * `EMAIL_FROM`). The visitor's address goes in `reply_to`, so replying from
 * the inbox answers them — the `from` has to be on the verified domain, the
 * visitor's never is.
 *
 * Everything the browser checked is checked again here, because anything
 * can call a server action. A filled honeypot gets a quiet success and no
 * email, so a bot learns nothing. Sends are capped per IP in the shared
 * `sign_in_attempts` table (`kind: "site_form"`) so the forms can't be used
 * to flood the inbox; the throttle is best-effort and never blocks a real
 * message if the database is unreachable.
 */
import { getDb } from "@/db/client";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { resolveClientIp } from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { contactEmail, openingListEmail, type BuiltEmail } from "@/lib/siteFormEmail";
import { checkIpThrottle, pruneSignInAttempts, recordSignInAttempt } from "@/lib/signInThrottle";
import {
  CONTACT_TOPICS,
  EMAIL_MAX,
  MESSAGE_MAX,
  NAME_MAX,
  PHONE_MAX,
  emailLooksSendable,
  type SiteFormResult,
} from "@/lib/siteFormFields";

/** Separates this throttle from sign-in and order lookup in the shared
 * `sign_in_attempts` table — see `src/lib/signInThrottle.ts`. */
const FORM_KIND = "site_form";
/** Sends per IP per 15 minutes, across both forms. Every send is recorded as
 * a counted (`succeeded: false`) row, since the throttle counts those. */
const MAX_SENDS = 5;

/** Neighbourhoods the opening list is offered for — anything else is not a
 * signup this site asked for. */
// Read at send time, not once at load: a store that opens stops taking
// sign-ups at that moment (Van Nuys, `VAN_NUYS_OPENS_AT`).
function isOpeningHood(hood: string): boolean {
  return locations.some((l) => !l.isOpen && l.neighbourhood === hood);
}

function field(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

/**
 * Form mail comes from its own sender, `Chris N Eddy's Website
 * <website@…>` on the same domain as `EMAIL_FROM`, so it stands apart from
 * order mail in the inbox and one mail rule can file it. No mailbox has to
 * exist at that address: every form email carries the visitor in `reply_to`,
 * so a reply never goes to it. Falls back to `EMAIL_FROM` as-is when its
 * domain can't be read off it.
 */
function formSender(): string | undefined {
  const domain = process.env.EMAIL_FROM?.match(/@([^\s>]+)>?\s*$/)?.[1];
  return domain ? `${brand.name} Website <website@${domain}>` : undefined;
}

/** True when this IP is already at the cap. Records this send against it
 * when it isn't. Fails open: a database hiccup must not eat a message. */
async function throttled(): Promise<boolean> {
  try {
    const db = await getDb();
    const ip = await resolveClientIp();
    const now = new Date();
    await pruneSignInAttempts(db, now);
    const status = await checkIpThrottle(db, ip, MAX_SENDS, now, FORM_KIND);
    if (status.locked) return true;
    // The email column stays empty: the throttle only needs the IP, and the
    // visitor's address has no reason to sit in a sign-in table.
    await recordSignInAttempt(db, "", ip, false, now, FORM_KIND);
    return false;
  } catch (err) {
    console.error("[site-form] throttle check failed; sending anyway", err);
    return false;
  }
}

async function deliver(built: BuiltEmail, replyTo: string): Promise<SiteFormResult> {
  if (!isEmailConfigured()) return { ok: false, reason: "not_configured" };
  if (await throttled()) return { ok: false, reason: "throttled" };
  const result = await sendEmail(
    brand.email,
    built.subject,
    built.text,
    built.html,
    replyTo,
    formSender(),
  );
  return result.sent ? { ok: true } : { ok: false, reason: "send_failed" };
}

export async function sendContactMessage(data: FormData): Promise<SiteFormResult> {
  if (field(data, "botcheck")) return { ok: true };

  const name = field(data, "name");
  const email = field(data, "email");
  const phone = field(data, "phone");
  const topic = field(data, "topic");
  const message = field(data, "message");

  if (
    !name ||
    name.length > NAME_MAX ||
    !emailLooksSendable(email) ||
    email.length > EMAIL_MAX ||
    phone.length > PHONE_MAX ||
    !(CONTACT_TOPICS as readonly string[]).includes(topic) ||
    !message ||
    message.length > MESSAGE_MAX
  ) {
    return { ok: false, reason: "invalid" };
  }

  return deliver(contactEmail({ name, email, phone, topic, message }), email);
}

export async function joinOpeningList(data: FormData): Promise<SiteFormResult> {
  if (field(data, "botcheck")) return { ok: true };

  const email = field(data, "email");
  const hood = field(data, "location");

  if (!emailLooksSendable(email) || email.length > EMAIL_MAX || !isOpeningHood(hood)) {
    return { ok: false, reason: "invalid" };
  }

  return deliver(openingListEmail({ email, hood }), email);
}
