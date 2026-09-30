/**
 * Transactional email — order confirmation, shipping notice, refund
 * confirmation, pickup-ready, password reset, owner invite — sent through
 * Resend's REST API with plain `fetch` (no SDK: one endpoint, one shape, not
 * worth a dependency). Gated on `RESEND_API_KEY` and `EMAIL_FROM` both being
 * set; without them nothing is sent, the attempt is logged, and the caller
 * gets `{ sent: false, reason }` back rather than a thrown error — a missing
 * Resend key must never fail the webhook that marks an order paid, or the
 * auth flow that resets a password or invites an owner.
 *
 * Transactional only, in the brand's plain, direct voice: what was bought,
 * what it cost, what happens next, who to ask. No marketing content, no
 * unsubscribe footer, no tracking pixel, no image that has to load for the
 * message to make sense (the header logo has the name as its alt text) — these are receipts, not a list.
 *
 * Every order email ships both a plain-text body (`text`) and a hand-written
 * table-based HTML body (`html`) built from the same order data, so either
 * one stands on its own. The wording and plain-text body are in
 * `emailOrderText.ts`, the HTML layout in `emailOrderHtml.ts`; this file
 * sends, and puts each email together.
 */
import "server-only";
import { getDb, type Db } from "@/db/client";
import { brand } from "@/data/brand";
import { getEditionSizes, getStoreSettings, type OrderWithItems } from "@/lib/orders";
import {
  centsToPrice,
  editionNumbersOf,
  firstName,
  formatNumberList,
  orderLookupUrl,
  receiptHeading,
  receiptSubject,
  shippingSubject,
  textBody,
  type Settings,
} from "@/lib/emailOrderText";
import {
  escapeHtml,
  htmlButton,
  htmlFulfilmentBox,
  htmlInfoBox,
  htmlItemRow,
  htmlNote,
  htmlShell,
  htmlTotals,
} from "@/lib/emailOrderHtml";

export type EmailResult = { sent: true } | { sent: false; reason: string };

/** The address a "reply to this email" promise actually has to land on.
 * `EMAIL_REPLY_TO` (read the same way `EMAIL_FROM` is, no extra gating) lets
 * the sending address and the reply address differ — Resend's `from` has to
 * be on a verified domain, a real inbox someone reads doesn't — and when
 * it's unset this falls back to the store's own support address, which is
 * already a real inbox stated in the same email's footer, so the promise
 * holds either way. */
function resolveReplyTo(settings: Settings): string {
  return process.env.EMAIL_REPLY_TO || settings.supportEmail;
}

/** Turns plain text into a minimal HTML document — one `<pre>`-style block,
 * used for the account emails (reset/invite) which are a single link and a
 * couple of sentences, not worth a dedicated layout. */
function plainHtmlBody(text: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;white-space:pre-wrap;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">${escapeHtml(text)}</body></html>`;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/** True once both env vars `sendEmail` is gated on are set — the same check
 * `src/app/(admin)/admin/forgot-password/actions.ts` and `page.tsx`
 * currently each duplicate locally, exported here so those (and anywhere
 * else that needs to answer "is email configured?", such as the settings
 * Connections card) can read it off one source instead. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
  replyTo?: string,
  /** Overrides `EMAIL_FROM` for this one message — it must still be on the
   * same verified domain. Sending is still gated on `EMAIL_FROM` being set. */
  fromOverride?: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const configuredFrom = process.env.EMAIL_FROM;

  if (!apiKey || !configuredFrom) {
    console.log(
      `[email] Resend not configured — would have sent "${subject}" to ${to || "(no address)"}`,
    );
    return { sent: false, reason: "Resend isn't configured (RESEND_API_KEY / EMAIL_FROM)." };
  }
  if (!to) {
    console.log(`[email] no recipient address for "${subject}"`);
    return { sent: false, reason: "No recipient email address." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromOverride || configuredFrom,
        to,
        subject,
        text,
        html: html ?? plainHtmlBody(text),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend responded ${res.status} for "${subject}": ${body}`);
      return { sent: false, reason: `Resend responded ${res.status}.` };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] Resend request failed for "${subject}"`, err);
    return { sent: false, reason: "Could not reach Resend." };
  }
}

export async function sendOrderConfirmation(order: OrderWithItems, db?: Db): Promise<EmailResult> {
  const database = db ?? (await getDb());
  const [settings, sizes] = await Promise.all([
    getStoreSettings(database),
    getEditionSizes(
      order.items.map((i) => i.variantId),
      database,
    ),
  ]);

  const heading = receiptHeading(order);
  const name = firstName(order);
  const numbers = editionNumbersOf(order);
  const intro =
    numbers.length > 0
      ? `${name ? `Thanks ${name}. ` : "Thanks. "}We've got the order and the money, and ${numbers.length === 1 ? "the hat is" : "the hats are"} coming out of the run with your number${numbers.length > 1 ? "s" : ""} on ${numbers.length > 1 ? "them" : "it"}.`
      : `${name ? `Thanks ${name}. ` : "Thanks. "}We've got the order and the money.`;

  const text = textBody(`${heading}\n\n${intro}`, order, sizes, settings, [
    order.fulfilment === "pickup"
      ? "We'll email you again the moment it's ready to pick up."
      : "We'll email you again with tracking once it ships.",
    `Check on this order any time: ${orderLookupUrl()}`,
  ]);

  const rowsHtml = [
    ...order.items.map((item) => htmlItemRow(item, sizes)),
    htmlTotals(order, "Paid"),
    htmlFulfilmentBox(order, settings),
    htmlButton(orderLookupUrl(), "CHECK ORDER STATUS"),
    htmlNote("No account needed — your order number and email get you in."),
  ].join("");

  const html = htmlShell({
    badgeLabel: "Receipt",
    heading,
    intro,
    orderNumber: order.number,
    rowsHtml,
    settings,
  });

  return sendEmail(order.email ?? "", receiptSubject(order, sizes), text, html);
}

export async function sendShippingNotice(order: OrderWithItems, db?: Db): Promise<EmailResult> {
  const database = db ?? (await getDb());
  const [settings, sizes] = await Promise.all([
    getStoreSettings(database),
    getEditionSizes(
      order.items.map((i) => i.variantId),
      database,
    ),
  ]);

  const hasTracking = Boolean(order.carrier && order.trackingNumber);
  const tracking = hasTracking
    ? [`Carrier: ${order.carrier}`, `Tracking number: ${order.trackingNumber}`]
    : [];

  const heading = "It's in the mail.";
  const intro = hasTracking
    ? `Your order is on its way — ${order.carrier}, tracking number ${order.trackingNumber}.`
    : "Your order is on its way.";

  const text = textBody(`${heading}\n\n${intro}`, order, sizes, settings, [
    ...tracking,
    "Wrong address, or it hasn't turned up? Reply to this email — it reaches a person.",
  ]);

  const rowsHtml = [
    hasTracking
      ? htmlInfoBox(
          "Tracking",
          `<span style="font-weight:bold">${escapeHtml(order.trackingNumber ?? "")}</span><br>${escapeHtml(order.carrier ?? "")}`,
        )
      : "",
    ...order.items.map((item) => htmlItemRow(item, sizes)),
    htmlFulfilmentBox(order, settings),
    htmlButton(orderLookupUrl(), "TRACK THIS ORDER"),
    htmlNote("Wrong address, or it hasn't turned up? Reply to this email — it reaches a person."),
  ].join("");

  const html = htmlShell({
    badgeLabel: "On its way",
    dark: true,
    heading,
    intro,
    orderNumber: order.number,
    rowsHtml,
    settings,
  });

  return sendEmail(order.email ?? "", shippingSubject(order), text, html, resolveReplyTo(settings));
}

export async function sendPickupReady(order: OrderWithItems, db?: Db): Promise<EmailResult> {
  const database = db ?? (await getDb());
  const [settings, sizes] = await Promise.all([
    getStoreSettings(database),
    getEditionSizes(
      order.items.map((i) => i.variantId),
      database,
    ),
  ]);

  // `fulfilmentLines` already states the pickup address + "bring this
  // email" line for any pickup order, so nothing extra is needed here.
  const text = textBody(
    `Your order from ${brand.name} is ready for pickup.`,
    order,
    sizes,
    settings,
  );

  return sendEmail(
    order.email ?? "",
    `Order ${order.number} is ready for pickup — ${brand.name}`,
    text,
  );
}

/**
 * Sent once Stripe confirms a *full* refund (`charge.refunded` with the
 * charge now fully refunded, or an owner using the desk's "Refund" action
 * as a backstop for a refund the webhook missed — see
 * `handleChargeRefunded` in `src/app/api/stripe/webhook/route.ts` and
 * `markRefunded` in `src/lib/ordersAdmin.ts`). Both call sites only reach
 * this after the order's own `subtotalCents`/`shippingCents`/`taxCents`/
 * `totalCents` already equal what was refunded — a full refund pays back
 * the whole order — so those columns are the amount stated here rather
 * than a separate Stripe amount threaded through.
 *
 * What the design's mock shows but the schema doesn't back: a card's last
 * four digits (Stripe doesn't hand this back on `charge.refunded`, and
 * nothing here stores it) — left out rather than invented.
 *
 * `options.released` is the "number N has gone back into the run" line.
 * Only the desk's owner-triggered refund can ever set it true (the
 * webhook's own backstop call always leaves it `false` — a Stripe-side
 * refund carries no opinion on whether the number should resell, see
 * `markRefunded` in `src/lib/orders.ts`), and even there it's the owner's
 * explicit choice on the `RefundPanel` toggle, not something inferred from
 * the refund itself. When it's true, the released numbers are just the
 * order's own edition numbers — `markRefunded` releases the whole order's
 * editions or none of them, so there's no partial case to represent here.
 */
export async function sendRefundConfirmation(
  order: OrderWithItems,
  options: { released?: boolean } = {},
  db?: Db,
): Promise<EmailResult> {
  const database = db ?? (await getDb());
  const [settings, sizes] = await Promise.all([
    getStoreSettings(database),
    getEditionSizes(
      order.items.map((i) => i.variantId),
      database,
    ),
  ]);

  const heading = "That's sorted.";
  const amount = centsToPrice(order.totalCents);
  const intro = `${amount} is on its way back to you. Banks take five to ten days, and there's nothing else for you to do.`;

  const numbers = options.released ? editionNumbersOf(order) : [];
  const releaseLine =
    numbers.length > 0
      ? numbers.length === 1
        ? `Number ${numbers[0]} has gone back into the run, so somebody else gets to have it.`
        : `Numbers ${formatNumberList(numbers)} have gone back into the run, so somebody else gets to have them.`
      : null;

  const text = textBody(`${heading}\n\n${intro}`, order, sizes, settings, [
    ...(releaseLine ? [releaseLine] : []),
    "Something not right about how this went? Reply here and it'll reach a person.",
  ]);

  const rowsHtml = [
    ...order.items.map((item) => htmlItemRow(item, sizes)),
    htmlTotals(order, "Refunded"),
    ...(releaseLine ? [htmlNote(releaseLine)] : []),
    htmlNote("Something not right about how this went? Reply here and it'll reach a person."),
  ].join("");

  const html = htmlShell({
    badgeLabel: "Refunded",
    heading,
    intro,
    orderNumber: order.number,
    rowsHtml,
    settings,
  });

  return sendEmail(
    order.email ?? "",
    `Refunded ${amount} for order ${order.number}`,
    text,
    html,
    resolveReplyTo(settings),
  );
}

export async function sendPasswordReset(to: string, url: string): Promise<EmailResult> {
  const text = [
    `Reset your password for the ${brand.name} admin.`,
    "",
    url,
    "",
    "This link lasts one hour and can only be used once.",
    "If you didn't ask for this, you can ignore this email.",
  ].join("\n");

  return sendEmail(to, `Reset your password — ${brand.name}`, text);
}

export async function sendOwnerInvite(to: string, url: string): Promise<EmailResult> {
  const text = [
    `You've been invited to the ${brand.name} admin.`,
    "",
    url,
    "",
    "Follow this link to set your password.",
  ].join("\n");

  return sendEmail(to, `You're invited to the ${brand.name} admin`, text);
}
