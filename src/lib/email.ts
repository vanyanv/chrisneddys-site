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
 * message to make sense — these are receipts, not a list.
 *
 * Every order email ships both a plain-text body (`text`) and a hand-written
 * table-based HTML body (`html`) built from the same order data, so either
 * one stands on its own.
 */
import "server-only";
import { getDb, type Db } from "@/db/client";
import { brand } from "@/data/brand";
import { absoluteUrl } from "@/lib/siteOrigin";
import { getEditionSizes, getStoreSettings, type OrderWithItems } from "@/lib/orders";

export type EmailResult = { sent: true } | { sent: false; reason: string };

type OrderItem = OrderWithItems["items"][number];
type Settings = { pickupAddress: string; returnsPolicy: string | null; supportEmail: string };

function centsToPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

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

// ---------------------------------------------------------------------------
// Shared order-shape helpers (used by both the text and HTML bodies)
// ---------------------------------------------------------------------------

/** The edition numbers on an order, ascending — empty for an order with no
 * numbered items. An edition product stores one order-item row per unit
 * (see `createPendingOrder` in `src/lib/orders.ts`), so this is also the
 * count of numbered units, not just distinct products. */
function editionNumbersOf(order: OrderWithItems): number[] {
  return order.items
    .map((item) => item.editionNumber)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
}

function formatNumberList(numbers: number[]): string {
  if (numbers.length === 1) return `${numbers[0]}`;
  if (numbers.length === 2) return `${numbers[0]} and ${numbers[1]}`;
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

/** "Number 35 is yours." / "Numbers 35 and 36 are yours." / a generic
 * fallback for an order with no numbered items — the thing a buyer of a
 * numbered hat actually cares about, stated up front. */
function receiptHeading(order: OrderWithItems): string {
  const numbers = editionNumbersOf(order);
  if (numbers.length === 1) return `Number ${numbers[0]} is yours.`;
  if (numbers.length > 1) return `Numbers ${formatNumberList(numbers)} are yours.`;
  return "Order confirmed.";
}

/** "Order CNE-1043 confirmed — number 35 of 50 is yours" for a single
 * numbered item (with the edition size only when it's actually known),
 * "... — numbers 35 and 36 are yours" for more than one, and the plain
 * generic subject for an order with no numbered items at all — a
 * quantity-only order has no number to print, so it falls back rather than
 * printing an empty value. */
function receiptSubject(order: OrderWithItems, sizes: Map<string, number | null>): string {
  const generic = `Order ${order.number} confirmed — ${brand.name}`;
  const numbers = editionNumbersOf(order);
  if (numbers.length === 0) return generic;
  if (numbers.length > 1) {
    return `Order ${order.number} confirmed — numbers ${formatNumberList(numbers)} are yours`;
  }
  const item = order.items.find((i) => i.editionNumber === numbers[0]);
  const size = item ? sizes.get(item.variantId) : null;
  const of = size ? ` of ${size}` : "";
  return `Order ${order.number} confirmed — number ${numbers[0]}${of} is yours`;
}

/** "Order CNE-1043 shipped — USPS" once a carrier is on file, falling back
 * to the plain generic subject otherwise. No ETA is ever printed here — the
 * schema has no delivery-estimate column (`carrier`/`trackingNumber` only,
 * see `orders` in `src/db/schema.ts`), so there is nothing genuine to state
 * beyond the carrier. */
function shippingSubject(order: OrderWithItems): string {
  if (!order.carrier) return `Order ${order.number} has shipped — ${brand.name}`;
  return `Order ${order.number} shipped — ${order.carrier}`;
}

function firstName(order: OrderWithItems): string | null {
  const name = order.name?.trim();
  return name ? (name.split(/\s+/)[0] ?? null) : null;
}

// Resolved per send rather than at import, so an order email sent from a
// Vercel preview links back to that preview (see `src/lib/siteOrigin.ts`).
const orderLookupUrl = () => absoluteUrl("/shop/order/");

function itemLine(item: OrderItem, sizes: Map<string, number | null>): string {
  if (item.editionNumber !== null) {
    const size = sizes.get(item.variantId);
    const of = size ? ` of ${size}` : "";
    return `  ${item.productName} — #${item.editionNumber}${of} — ${centsToPrice(item.unitPriceCents)}`;
  }
  return `  ${item.productName} × ${item.quantity} — ${centsToPrice(item.unitPriceCents * item.quantity)}`;
}

function totalsLines(order: OrderWithItems): string[] {
  const lines = [`Subtotal: ${centsToPrice(order.subtotalCents)}`];
  if (order.shippingCents > 0) lines.push(`Shipping: ${centsToPrice(order.shippingCents)}`);
  if (order.taxCents > 0) lines.push(`Tax: ${centsToPrice(order.taxCents)}`);
  lines.push(`Total: ${centsToPrice(order.totalCents)}`);
  return lines;
}

function fulfilmentLines(order: OrderWithItems, settings: Settings): string[] {
  if (order.fulfilment === "pickup") {
    return ["Pickup", `Pickup at ${settings.pickupAddress}. Bring this email.`];
  }
  const ship = order.shipTo;
  if (!ship) return ["Shipping"];
  const line2 = ship.line2 ? ` ${ship.line2}` : "";
  return [
    "Shipping to",
    `${ship.name}`,
    `${ship.line1}${line2}`,
    `${ship.city}, ${ship.state} ${ship.postalCode}`,
    ship.country,
  ];
}

function textBody(
  heading: string,
  order: OrderWithItems,
  sizes: Map<string, number | null>,
  settings: Settings,
  extraLines: string[] = [],
): string {
  const lines = [
    heading,
    "",
    `Order ${order.number}`,
    "",
    ...order.items.map((item) => itemLine(item, sizes)),
    "",
    ...totalsLines(order),
    "",
    ...fulfilmentLines(order, settings),
    ...(extraLines.length > 0 ? ["", ...extraLines] : []),
  ];
  if (settings.returnsPolicy) lines.push("", settings.returnsPolicy);
  lines.push("", `Questions? ${settings.supportEmail}`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Turns plain text into a minimal HTML document — one `<pre>`-style block,
 * used for the account emails (reset/invite) which are a single link and a
 * couple of sentences, not worth a dedicated layout. */
function plainHtmlBody(text: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;white-space:pre-wrap;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">${escapeHtml(text)}</body></html>`;
}

// ---------------------------------------------------------------------------
// HTML layout — a single-column, table-based shell shared by the receipt,
// shipping notice and refund confirmation, styled after the brand's paper
// and stamp look with web-safe fonts (no external stylesheet, no webfont, no
// image — the message has to make sense with images blocked).
// ---------------------------------------------------------------------------

const PAPER = "#fff8e7";
const CREAM = "#fff2c9";
const CARD = "#fffdf6";
const INK = "#1a1612";
const RULE = "#e3d8bc";
const MUTED = "#6f6857";
const YELLOW = "#f5b82e";
const YELLOW_DEEP = "#e09e0e";
const DISPLAY_FONT = "'Arial Black', Impact, 'Franklin Gothic Bold', sans-serif";
const MONO_FONT = "'JetBrains Mono', 'Courier New', Courier, monospace";
const BODY_FONT = "Arial, Helvetica, sans-serif";

/** A single-column row wrapping arbitrary content — every `<tr>` in the
 * shell has exactly one `<td>`, so column counts never have to line up
 * between rows in Outlook and other table-literal renderers. */
function row(innerHtml: string, style = ""): string {
  return `<tr><td style="${style}">${innerHtml}</td></tr>`;
}

/** A label/value pair laid out as its own two-cell table, nested inside a
 * single-column `row()`. */
function pair(leftHtml: string, rightHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${leftHtml}</td><td align="right">${rightHtml}</td></tr></table>`;
}

function htmlItemRow(item: OrderItem, sizes: Map<string, number | null>): string {
  const size = item.editionNumber !== null ? sizes.get(item.variantId) : null;
  const right =
    item.editionNumber !== null
      ? `NUMBER ${item.editionNumber}${size ? ` OF ${size}` : ""}`
      : `QTY ${item.quantity}`;
  const price =
    item.editionNumber !== null
      ? centsToPrice(item.unitPriceCents)
      : centsToPrice(item.unitPriceCents * item.quantity);

  const head = pair(
    `<span style="font-family:${BODY_FONT};font-size:14px;font-weight:bold;color:${INK}">${escapeHtml(item.productName)}</span>`,
    `<span style="font-family:${MONO_FONT};font-size:11px;letter-spacing:.04em;color:${INK};white-space:nowrap">${escapeHtml(right)}</span>`,
  );
  return row(
    `${head}<div style="font-family:${MONO_FONT};font-size:12px;color:${MUTED};padding-top:3px">${price}</div>`,
    `padding:12px 0;border-top:1px solid ${RULE}`,
  );
}

function htmlMoneyRow(label: string, cents: number, opts: { bold?: boolean } = {}): string {
  const size = opts.bold ? "14px" : "12px";
  const weight = opts.bold ? "bold" : "normal";
  const color = opts.bold ? INK : MUTED;
  const border = opts.bold ? `border-top:1px solid ${RULE};padding-top:8px` : "padding:2px 0";
  return row(
    pair(
      `<span style="font-family:${BODY_FONT};font-size:${size};font-weight:${weight};color:${color}">${escapeHtml(label)}</span>`,
      `<span style="font-family:${MONO_FONT};font-size:${size};font-weight:${weight};color:${color}">${centsToPrice(cents)}</span>`,
    ),
    border,
  );
}

function htmlTotals(order: OrderWithItems, totalLabel: string): string {
  const rows = [htmlMoneyRow("Subtotal", order.subtotalCents)];
  if (order.shippingCents > 0) rows.push(htmlMoneyRow("Shipping", order.shippingCents));
  if (order.taxCents > 0) rows.push(htmlMoneyRow("Tax", order.taxCents));
  rows.push(htmlMoneyRow(totalLabel, order.totalCents, { bold: true }));
  return rows.join("");
}

function htmlInfoBox(label: string, bodyHtml: string): string {
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${RULE};background:${PAPER}"><tr><td style="padding:12px 14px">
    <div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:bold;color:${MUTED};margin-bottom:5px">${escapeHtml(label)}</div>
    <div style="font-family:${MONO_FONT};font-size:12px;line-height:1.7;color:${INK}">${bodyHtml}</div>
  </td></tr></table>`;
  return row(inner, "padding-top:14px");
}

/** The "Going to" / pickup box — the HTML counterpart of `fulfilmentLines`. */
function htmlFulfilmentBox(order: OrderWithItems, settings: Settings): string {
  if (order.fulfilment === "pickup") {
    return htmlInfoBox(
      "Pickup",
      `Pickup at ${escapeHtml(settings.pickupAddress)}. Bring this email.`,
    );
  }
  const ship = order.shipTo;
  if (!ship) return "";
  const line2 = ship.line2 ? `<br>${escapeHtml(ship.line2)}` : "";
  return htmlInfoBox(
    "Going to",
    `${escapeHtml(ship.name)}<br>${escapeHtml(ship.line1)}${line2}<br>${escapeHtml(ship.city)}, ${escapeHtml(ship.state)} ${escapeHtml(ship.postalCode)}`,
  );
}

function htmlButton(href: string, label: string): string {
  const link = `<a href="${escapeHtml(href)}" style="display:inline-block;background:${YELLOW};border:1px solid ${YELLOW_DEEP};color:${INK};font-family:${DISPLAY_FONT};font-weight:bold;font-size:13px;letter-spacing:.02em;padding:12px 26px;text-decoration:none">${escapeHtml(label)}</a>`;
  return row(link, "padding:18px 0 4px;text-align:center");
}

function htmlNote(text: string): string {
  return row(
    `<p style="margin:0;font-family:${BODY_FONT};font-size:11.5px;color:${MUTED};text-align:center;line-height:1.6">${escapeHtml(text)}</p>`,
    "padding-top:14px",
  );
}

function htmlShell(opts: {
  badgeLabel: string;
  dark?: boolean;
  heading: string;
  intro: string;
  orderNumber: string;
  rowsHtml: string;
  settings: Settings;
}): string {
  const headBg = opts.dark ? INK : CREAM;
  const headColor = opts.dark ? PAPER : INK;
  const headingHtml = escapeHtml(opts.heading).replace(/\n/g, "<br>");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD};border:1px solid ${RULE}">
      <tr><td style="background:${headBg};padding:14px 20px">
        ${pair(
          `<span style="font-family:${DISPLAY_FONT};font-size:17px;color:${headColor}">${escapeHtml(brand.name)}</span>`,
          `<span style="font-family:${MONO_FONT};font-size:10px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:${headColor}">${escapeHtml(opts.badgeLabel)}</span>`,
        )}
      </td></tr>
      <tr><td style="padding:22px 20px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row(`<h1 style="margin:0;font-family:${DISPLAY_FONT};font-weight:bold;font-size:23px;line-height:1.15;color:${INK}">${headingHtml}</h1>`)}
          ${row(`<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};padding-top:6px">Order ${escapeHtml(opts.orderNumber)}</div>`)}
          ${row(`<p style="margin:0;font-family:${BODY_FONT};font-size:13px;color:${MUTED};line-height:1.6">${escapeHtml(opts.intro)}</p>`, "padding-top:8px")}
          ${opts.rowsHtml}
        </table>
      </td></tr>
      <tr><td style="padding:14px 20px;border-top:1px solid ${RULE};background:${PAPER}">
        ${pair(
          `<span style="font-family:${MONO_FONT};font-size:9px;letter-spacing:.06em;color:${MUTED}">${escapeHtml(opts.settings.pickupAddress.split(",")[0] ?? opts.settings.pickupAddress)}</span>`,
          `<a href="mailto:${escapeHtml(opts.settings.supportEmail)}" style="font-family:${MONO_FONT};font-size:9px;letter-spacing:.06em;color:${MUTED};text-decoration:underline">${escapeHtml(opts.settings.supportEmail)}</a>`,
        )}
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
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
