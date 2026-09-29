/**
 * Catering email builders and senders — the customer request/booked/
 * declined/expired/cancelled/change/find-my-orders/thank-you emails and the
 * owner's itemized "new catering request" email. Follows the shell pattern
 * of `src/lib/email.ts` (a single-column table-based HTML body, `holdColors`
 * for dark mode, the header wordmark from `emailLogoImg`) but is its own,
 * simpler shell: catering emails don't share the receipt/shipping/refund
 * layout those builders already own, and duplicating that shell here (rather
 * than reaching into its unexported helpers) keeps this module free-standing.
 *
 * Every builder returns `{subject, html, text}` and takes plain data, not a
 * database row directly, so `renderCateringEmailPreviews()` can call every
 * one of them against one hand-built sample order for the admin preview page
 * (`/admin/catering/emails/`) with no database involved.
 */
import "server-only";
import {
  centsToPrice,
  escapeHtml,
  isEmailConfigured,
  sendEmail,
  type EmailResult,
} from "@/lib/email";
import { holdColors } from "@/lib/emailColor";
import { emailLogoImg } from "@/lib/emailLogo";
import { absoluteUrl } from "@/lib/siteOrigin";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { googleDirections } from "@/lib/directions";
import type { Db } from "@/db/client";
import type { CateringAddress } from "@/db/schema";
import { LA_ZONE } from "./timezone";
import { readyByMs, driverLeavesMs } from "./schedule";
import { getCateringSettings } from "./settings";
import type { CateringOrderItem, CateringOrderWithItems } from "./orders";

export type CateringEmailContent = { subject: string; html: string; text: string };

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: LA_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: LA_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(d: Date): string {
  return DATE_FMT.format(d);
}
function formatTime(d: Date): string {
  return TIME_FMT.format(d);
}
function formatDateTime(d: Date): string {
  return `${formatDate(d)}, ${formatTime(d)}`;
}

function storeName(id: string): string {
  return locations.find((l) => l.id === id)?.name ?? id;
}

function storeReviewLink(id: string): string {
  // No Google review link is kept anywhere in `src/data` today (checked
  // `locations.ts` and `brand.ts`) — the store's own Maps link is the
  // fallback the build plan names for exactly this case.
  const location = locations.find((l) => l.id === id);
  return location ? googleDirections(location) : brand.siteUrl;
}

function orderLink(token: string): string {
  return absoluteUrl(`/catering/o/${token}/`);
}
function adminOrderLink(id: string): string {
  return absoluteUrl(`/admin/catering/${id}/`);
}
function crewTicketLink(id: string): string {
  return absoluteUrl(`/admin/catering/${id}/crew-ticket/`);
}
function invoiceLink(id: string): string {
  return absoluteUrl(`/admin/catering/${id}/invoice/`);
}
function contactLink(): string {
  return absoluteUrl("/contact/");
}

function fulfilmentSummary(order: CateringOrderWithItems): string {
  const when = formatDateTime(order.eventAt);
  if (order.fulfilment === "pickup") {
    return `Pickup from ${storeName(order.store)}, ${when}`;
  }
  return `Delivery from ${storeName(order.store)}, ${when}`;
}

/** One line per line item: "2 Sliders and Fries — Chris's Way · Lettuce,
 * Sauce, Raw Onion" plus an extras/for/note tail, in the order the owner's
 * itemized email (`e2-owner-email-new-request.png`) shows them. */
function itemLineText(item: CateringOrderItem): string {
  const bits: string[] = [];
  if (item.wayLabel) bits.push(item.wayLabel);
  if (item.toppingLabels.length > 0) bits.push(item.toppingLabels.join(", "));
  const descriptor = bits.length > 0 ? ` — ${bits.join(" · ")}` : "";

  const tail: string[] = [];
  if (item.extraLabels.length > 0) tail.push(item.extraLabels.join(", "));
  if (item.forName) tail.push(`for ${item.forName}`);
  if (item.note) tail.push(`"${item.note}"`);
  const tailStr = tail.length > 0 ? ` (${tail.join("; ")})` : "";

  return `${item.qty} ${item.itemName}${descriptor}${tailStr} — ${centsToPrice(item.amountCents)}`;
}

function addressLines(address: CateringAddress): string[] {
  const line2 = address.line2 ? [address.line2] : [];
  const lines = [address.line1, ...line2, `${address.city}, ${address.state} ${address.zip}`];
  if (address.instructions) lines.push(address.instructions);
  return lines;
}

// ---------------------------------------------------------------------------
// HTML shell — a small, catering-specific single-column table shell.
// ---------------------------------------------------------------------------

const PAPER = "#fff8e7";
const CARD = "#fffdf6";
const INK = "#1a1612";
const RULE = "#e3d8bc";
const MUTED = "#6f6857";
const YELLOW = "#f5b82e";
const YELLOW_DEEP = "#e09e0e";
const DISPLAY_FONT = "'Arial Black', Impact, 'Franklin Gothic Bold', sans-serif";
const BODY_FONT = "Arial, Helvetica, sans-serif";
const MONO_FONT = "'JetBrains Mono', 'Courier New', Courier, monospace";

function row(innerHtml: string, style = ""): string {
  return `<tr><td style="${style}">${innerHtml}</td></tr>`;
}

function htmlButton(href: string, label: string): string {
  const link = `<a href="${escapeHtml(href)}" style="display:inline-block;background:${YELLOW};border:1px solid ${YELLOW_DEEP};color:${INK};font-family:${DISPLAY_FONT};font-weight:bold;font-size:13px;letter-spacing:.02em;padding:12px 26px;text-decoration:none">${escapeHtml(label)}</a>`;
  return row(link, "padding:10px 0 4px;text-align:center");
}

function htmlSecondaryLink(href: string, label: string): string {
  return row(
    `<a href="${escapeHtml(href)}" style="font-family:${BODY_FONT};font-size:12px;color:${MUTED};text-decoration:underline">${escapeHtml(label)}</a>`,
    "padding:4px 0;text-align:center",
  );
}

function htmlParagraph(text: string): string {
  return row(
    `<p style="margin:0;font-family:${BODY_FONT};font-size:13px;color:${INK};line-height:1.6">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`,
    "padding-top:8px",
  );
}

function htmlItemsTable(items: CateringOrderItem[]): string {
  const rows = items
    .map((item) => {
      const details: string[] = [];
      if (item.wayLabel) details.push(escapeHtml(item.wayLabel));
      if (item.toppingLabels.length > 0) details.push(escapeHtml(item.toppingLabels.join(", ")));
      if (item.extraLabels.length > 0) details.push(escapeHtml(item.extraLabels.join(", ")));
      const detailHtml =
        details.length > 0
          ? `<div style="font-family:${BODY_FONT};font-size:11.5px;color:${MUTED};padding-top:2px">${details.join(" · ")}</div>`
          : "";
      const forHtml = item.forName
        ? `<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${INK};background:${YELLOW};display:inline-block;padding:2px 6px;margin-top:3px">For ${escapeHtml(item.forName)}</div>`
        : "";
      const noteHtml = item.note
        ? `<div style="font-family:${BODY_FONT};font-size:11.5px;font-style:italic;color:${MUTED};padding-top:3px">"${escapeHtml(item.note)}"</div>`
        : "";
      const head = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><span style="font-family:${BODY_FONT};font-size:14px;font-weight:bold;color:${INK}">${item.qty} ${escapeHtml(item.itemName)}</span></td><td align="right"><span style="font-family:${MONO_FONT};font-size:13px;color:${INK}">${centsToPrice(item.amountCents)}</span></td></tr></table>`;
      return row(
        `${head}${detailHtml}${forHtml}${noteHtml}`,
        `padding:10px 0;border-top:1px solid ${RULE}`,
      );
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function moneyRow(label: string, cents: number, bold = false): string {
  const weight = bold ? "bold" : "normal";
  const color = bold ? INK : MUTED;
  const border = bold ? `border-top:1px solid ${RULE};padding-top:8px` : "padding:2px 0";
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><span style="font-family:${BODY_FONT};font-size:13px;font-weight:${weight};color:${color}">${escapeHtml(label)}</span></td><td align="right"><span style="font-family:${MONO_FONT};font-size:13px;font-weight:${weight};color:${color}">${centsToPrice(cents)}</span></td></tr></table>`,
    border,
  );
}

function htmlTotals(order: CateringOrderWithItems, totalLabel = "Total"): string {
  const rows = [moneyRow("Food", order.foodCents)];
  if (order.deliveryCents > 0) rows.push(moneyRow("Delivery", order.deliveryCents));
  rows.push(moneyRow("Tax", order.taxCents));
  if (order.tipCents > 0) rows.push(moneyRow("Tip for the crew", order.tipCents));
  rows.push(moneyRow(totalLabel, order.totalCents, true));
  return rows.join("");
}

function htmlInfoBox(label: string, bodyHtml: string): string {
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${RULE};background:${PAPER}"><tr><td style="padding:12px 14px">
    <div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:bold;color:${MUTED};margin-bottom:5px">${escapeHtml(label)}</div>
    <div style="font-family:${BODY_FONT};font-size:12.5px;line-height:1.7;color:${INK}">${bodyHtml}</div>
  </td></tr></table>`;
  return row(inner, "padding-top:12px");
}

function htmlShell(opts: {
  badgeLabel: string;
  heading: string;
  orderNumber: string;
  rowsHtml: string;
}): string {
  return holdColors(`<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD};border:1px solid ${RULE}">
      <tr><td style="background:${INK};padding:14px 20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${emailLogoImg(PAPER)}</td><td align="right"><span style="font-family:${MONO_FONT};font-size:10px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:${PAPER}">${escapeHtml(opts.badgeLabel)}</span></td></tr></table>
      </td></tr>
      <tr><td style="padding:22px 20px 6px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row(`<h1 style="margin:0;font-family:${DISPLAY_FONT};font-weight:bold;font-size:22px;line-height:1.2;color:${INK}">${escapeHtml(opts.heading)}</h1>`)}
          ${row(`<div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};padding-top:6px">Order ${escapeHtml(opts.orderNumber)}</div>`)}
          ${opts.rowsHtml}
        </table>
      </td></tr>
      <tr><td style="padding:14px 20px;border-top:1px solid ${RULE};background:${PAPER}">
        <span style="font-family:${MONO_FONT};font-size:9px;letter-spacing:.06em;color:${MUTED}">${escapeHtml(brand.name)} catering</span>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`);
}

// ---------------------------------------------------------------------------
// Customer emails
// ---------------------------------------------------------------------------

export function buildRequestReceivedEmail(order: CateringOrderWithItems): CateringEmailContent {
  const respondBy = order.respondBy ? formatDateTime(order.respondBy) : "soon";
  const heading = "Request received.";
  const intro = `We'll confirm by ${respondBy}. Your card is held for ${centsToPrice(order.totalCents)}, not charged.`;

  const text = [
    heading,
    "",
    intro,
    "",
    fulfilmentSummary(order),
    ...order.items.map((i) => `  ${itemLineText(i)}`),
    "",
    `View or change your order: ${orderLink(order.token)}`,
  ].join("\n");

  const rowsHtml = [
    htmlParagraph(intro),
    htmlButton(orderLink(order.token), "VIEW OR CHANGE"),
  ].join("");

  return {
    subject: `We got your catering request ${order.number}`,
    html: htmlShell({
      badgeLabel: "Request received",
      heading,
      orderNumber: order.number,
      rowsHtml,
    }),
    text,
  };
}

export function buildBookedEmail(order: CateringOrderWithItems): CateringEmailContent {
  const firstName = order.contactName.trim().split(/\s+/)[0] ?? order.contactName;
  const heading = `You're booked, ${firstName}.`;
  const cancelFreeUntil = new Date(order.eventAt.getTime() - 48 * 60 * 60 * 1000);
  const summary =
    order.fulfilment === "delivery" && order.address
      ? `${formatDateTime(order.eventAt)}, delivered from ${storeName(order.store)} to ${order.address.line1}${order.address.line2 ? ` ${order.address.line2}` : ""}.`
      : `${formatDateTime(order.eventAt)}, pickup at ${storeName(order.store)}.`;

  const text = [
    heading,
    "",
    summary,
    "",
    `Charged ${centsToPrice(order.totalCents)}`,
    "",
    `Free to cancel until ${formatDateTime(cancelFreeUntil)}.`,
    "",
    `View your order: ${orderLink(order.token)}`,
  ].join("\n");

  const rowsHtml = [
    htmlParagraph(summary),
    moneyRow("Charged", order.totalCents, true),
    htmlParagraph(`Free to cancel until ${formatDateTime(cancelFreeUntil)}.`),
    htmlButton(orderLink(order.token), "VIEW ORDER"),
  ].join("");

  return {
    subject: `You're booked: ${brand.name} catering, ${formatDate(order.eventAt)}`,
    html: htmlShell({ badgeLabel: "Booked", heading, orderNumber: order.number, rowsHtml }),
    text,
  };
}

export function buildDeclinedEmail(
  order: CateringOrderWithItems,
  reason: string,
): CateringEmailContent {
  const heading = "We can't take this one.";
  const intro = `Your card was never charged. ${reason}`;

  const text = [heading, "", intro, "", `Questions? ${contactLink()}`].join("\n");

  const rowsHtml = [htmlParagraph(intro), htmlButton(contactLink(), "CONTACT US")].join("");

  return {
    subject: `Catering request ${order.number} declined`,
    html: htmlShell({ badgeLabel: "Declined", heading, orderNumber: order.number, rowsHtml }),
    text,
  };
}

export function buildExpiredEmail(order: CateringOrderWithItems): CateringEmailContent {
  const heading = "This request expired.";
  const intro =
    "We didn't confirm in time, so the hold on your card was released and you weren't charged.";

  const text = [heading, "", intro, "", `Try again: ${contactLink()}`].join("\n");
  const rowsHtml = [htmlParagraph(intro), htmlButton(contactLink(), "GET IN TOUCH")].join("");

  return {
    subject: `Catering request ${order.number} expired`,
    html: htmlShell({ badgeLabel: "Expired", heading, orderNumber: order.number, rowsHtml }),
    text,
  };
}

export function buildCancelledEmail(
  order: CateringOrderWithItems,
  refundCents: number,
): CateringEmailContent {
  const heading = "Cancelled.";
  const intro =
    refundCents > 0
      ? `${centsToPrice(refundCents)} is on its way back to you. Banks take five to ten days.`
      : "This order fell inside the no-refund window, so nothing is being refunded.";

  const text = [heading, "", intro].join("\n");
  const rowsHtml = [htmlParagraph(intro)].join("");

  return {
    subject: `Order ${order.number} cancelled`,
    html: htmlShell({ badgeLabel: "Cancelled", heading, orderNumber: order.number, rowsHtml }),
    text,
  };
}

export function buildChangeReceivedEmail(order: CateringOrderWithItems): CateringEmailContent {
  const heading = "Change received.";
  const intro =
    "We'll email you once it's approved or declined — your card hasn't been touched yet.";

  const text = [heading, "", intro, "", `View your order: ${orderLink(order.token)}`].join("\n");
  const rowsHtml = [htmlParagraph(intro), htmlButton(orderLink(order.token), "VIEW ORDER")].join(
    "",
  );

  return {
    subject: `Change requested for order ${order.number}`,
    html: htmlShell({
      badgeLabel: "Change received",
      heading,
      orderNumber: order.number,
      rowsHtml,
    }),
    text,
  };
}

export function buildChangeApprovedEmail(order: CateringOrderWithItems): CateringEmailContent {
  const heading = "Change approved.";
  const intro = `Your order now totals ${centsToPrice(order.totalCents)}.`;

  const text = [heading, "", intro, "", `View your order: ${orderLink(order.token)}`].join("\n");
  const rowsHtml = [
    htmlParagraph(intro),
    htmlTotals(order),
    htmlButton(orderLink(order.token), "VIEW ORDER"),
  ].join("");

  return {
    subject: `Change approved for order ${order.number}`,
    html: htmlShell({
      badgeLabel: "Change approved",
      heading,
      orderNumber: order.number,
      rowsHtml,
    }),
    text,
  };
}

export function buildChangeDeclinedEmail(
  order: CateringOrderWithItems,
  reason?: string,
): CateringEmailContent {
  const heading = "Change declined.";
  const intro = reason
    ? `Your order stays as it was. ${reason}`
    : "Your order stays as it was — nothing changed and nothing was charged.";

  const text = [heading, "", intro, "", `View your order: ${orderLink(order.token)}`].join("\n");
  const rowsHtml = [htmlParagraph(intro), htmlButton(orderLink(order.token), "VIEW ORDER")].join(
    "",
  );

  return {
    subject: `Change declined for order ${order.number}`,
    html: htmlShell({
      badgeLabel: "Change declined",
      heading,
      orderNumber: order.number,
      rowsHtml,
    }),
    text,
  };
}

export type FindMyOrdersEntry = { number: string; token: string; eventAt: Date };

/** Always built the same way whether or not `email` matches any order — the
 * server action deliberately never distinguishes the two cases, so a probe
 * can't learn whether an address has ordered before. */
export function buildFindMyOrdersEmail(orders: FindMyOrdersEntry[]): CateringEmailContent {
  const heading = "Your catering orders.";
  const intro =
    orders.length > 0
      ? "Here's a link to each one."
      : "We didn't find any catering orders for this email address.";

  const lines = orders.map(
    (o) => `  ${o.number} — ${formatDate(o.eventAt)} — ${orderLink(o.token)}`,
  );
  const text = [heading, "", intro, "", ...lines].join("\n");

  const linkRows = orders
    .map((o) => htmlSecondaryLink(orderLink(o.token), `${o.number} — ${formatDate(o.eventAt)}`))
    .join("");
  const rowsHtml = [htmlParagraph(intro), linkRows].join("");

  return {
    subject: `Your ${brand.name} catering orders`,
    html: htmlShell({ badgeLabel: "Find my orders", heading, orderNumber: "", rowsHtml }),
    text,
  };
}

export function buildThankYouEmail(order: CateringOrderWithItems): CateringEmailContent {
  const heading = "Thanks for having us cater.";
  const intro = "Hope the crew ate well. If you have a minute, a review helps a lot.";
  const reviewLink = storeReviewLink(order.store);

  const text = [heading, "", intro, "", `Leave a review: ${reviewLink}`].join("\n");
  const rowsHtml = [htmlParagraph(intro), htmlButton(reviewLink, "LEAVE A REVIEW")].join("");

  return {
    subject: `Thanks from ${brand.name}`,
    html: htmlShell({ badgeLabel: "Thank you", heading, orderNumber: order.number, rowsHtml }),
    text,
  };
}

// ---------------------------------------------------------------------------
// Owner email
// ---------------------------------------------------------------------------

export function buildOwnerNewRequestEmail(order: CateringOrderWithItems): CateringEmailContent {
  const heading = `New catering request ${order.number}`;
  const readyBy = new Date(readyByMs(order.eventAt.getTime()));
  const driverLeaves =
    order.fulfilment === "delivery" ? new Date(driverLeavesMs(order.eventAt.getTime())) : null;

  const locationLines = [
    `${storeName(order.store)} · ${order.fulfilment === "delivery" ? "Delivery" : "Pickup"}`,
  ];
  const timeLines = [
    `${order.fulfilment === "delivery" ? "Deliver" : "Ready"} by ${formatDateTime(order.eventAt)}`,
    `Ready by (kitchen) ${formatTime(readyBy)}`,
    ...(driverLeaves ? [`Driver leaves ${formatTime(driverLeaves)}`] : []),
  ];

  const contactLines = [
    `${order.contactName} · ${order.contactEmail} · ${order.contactPhone}`,
    ...(order.company ? [order.company] : []),
    ...(order.poNumber ? [`PO ${order.poNumber}`] : []),
    ...(order.onsiteContactName
      ? [
          `Onsite: ${order.onsiteContactName}${order.onsiteContactPhone ? ` · ${order.onsiteContactPhone}` : ""}`,
        ]
      : []),
  ];

  const addressLinesText = order.address ? addressLines(order.address) : [];
  const rangeFlag = order.rangeUnknown
    ? ["Delivery ZIP not recognized — confirm the address."]
    : order.distanceMiles != null
      ? [`About ${order.distanceMiles} mi from ${storeName(order.store)}.`]
      : [];

  const text = [
    heading,
    `Needs a reply by ${order.respondBy ? formatDateTime(order.respondBy) : "soon"}`,
    "",
    ...locationLines,
    ...timeLines,
    "",
    ...order.items.map((i) => itemLineText(i)),
    "",
    `Food: ${centsToPrice(order.foodCents)}`,
    ...(order.deliveryCents > 0 ? [`Delivery: ${centsToPrice(order.deliveryCents)}`] : []),
    `Tax: ${centsToPrice(order.taxCents)}`,
    ...(order.tipCents > 0 ? [`Tip: ${centsToPrice(order.tipCents)}`] : []),
    `Total: ${centsToPrice(order.totalCents)}`,
    "",
    ...contactLines,
    ...addressLinesText,
    ...rangeFlag,
    ...(order.customerNote ? [`Note: "${order.customerNote}"`] : []),
    "",
    `Review in admin: ${adminOrderLink(order.id)}`,
    `Crew ticket: ${crewTicketLink(order.id)}`,
    `Invoice: ${invoiceLink(order.id)}`,
  ].join("\n");

  const infoBoxes = [
    htmlInfoBox("Location", locationLines.map(escapeHtml).join("<br>")),
    htmlInfoBox("Times", timeLines.map(escapeHtml).join("<br>")),
    htmlInfoBox(
      "Customer",
      [...contactLines, ...addressLinesText].map(escapeHtml).join("<br>") +
        (rangeFlag.length > 0
          ? `<br><span style="color:${YELLOW_DEEP};font-weight:bold">${rangeFlag.map(escapeHtml).join("<br>")}</span>`
          : "") +
        (order.customerNote ? `<br><em>"${escapeHtml(order.customerNote)}"</em>` : ""),
    ),
  ].join("");

  const rowsHtml = [
    infoBoxes,
    htmlItemsTable(order.items),
    htmlTotals(order),
    htmlButton(adminOrderLink(order.id), "REVIEW IN ADMIN"),
    htmlSecondaryLink(crewTicketLink(order.id), "Crew ticket"),
    htmlSecondaryLink(invoiceLink(order.id), "Invoice"),
  ].join("");

  return {
    subject: `New catering request ${order.number} — needs you by ${order.respondBy ? formatDateTime(order.respondBy) : "soon"}`,
    html: htmlShell({ badgeLabel: "New request", heading, orderNumber: order.number, rowsHtml }),
    text,
  };
}

// ---------------------------------------------------------------------------
// Senders — thin wrappers over `sendEmail`, no-op (logged) when Resend isn't
// configured, same as every other transactional email in this repo.
// ---------------------------------------------------------------------------

async function ownerEmail(db?: Db): Promise<string> {
  const settings = await getCateringSettings(db);
  return settings.ownerEmail;
}

/** `subjectPrefix` exists for the admin "Send test emails" button
 * (`sendCateringTestEmails`) — real orders never pass it. */
export type SendOptions = { subjectPrefix?: string };

export async function sendRequestReceivedEmail(
  order: CateringOrderWithItems,
  options: SendOptions = {},
): Promise<EmailResult> {
  const { subject, html, text } = buildRequestReceivedEmail(order);
  return sendEmail(order.contactEmail, `${options.subjectPrefix ?? ""}${subject}`, text, html);
}

export async function sendBookedEmail(order: CateringOrderWithItems): Promise<EmailResult> {
  const { subject, html, text } = buildBookedEmail(order);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendDeclinedEmail(
  order: CateringOrderWithItems,
  reason: string,
): Promise<EmailResult> {
  const { subject, html, text } = buildDeclinedEmail(order, reason);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendExpiredEmail(order: CateringOrderWithItems): Promise<EmailResult> {
  const { subject, html, text } = buildExpiredEmail(order);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendCancelledEmail(
  order: CateringOrderWithItems,
  refundCents: number,
): Promise<EmailResult> {
  const { subject, html, text } = buildCancelledEmail(order, refundCents);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendChangeReceivedEmail(order: CateringOrderWithItems): Promise<EmailResult> {
  const { subject, html, text } = buildChangeReceivedEmail(order);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendChangeApprovedEmail(order: CateringOrderWithItems): Promise<EmailResult> {
  const { subject, html, text } = buildChangeApprovedEmail(order);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendChangeDeclinedEmail(
  order: CateringOrderWithItems,
  reason?: string,
): Promise<EmailResult> {
  const { subject, html, text } = buildChangeDeclinedEmail(order, reason);
  return sendEmail(order.contactEmail, subject, text, html);
}

/** Always resolves `{sent: ...}` regardless of whether `email` matched any
 * order — never lets a caller distinguish "sent to a known address" from
 * "sent to an unknown one" (see `buildFindMyOrdersEmail`). */
export async function sendFindMyOrdersEmail(
  email: string,
  orders: FindMyOrdersEntry[],
): Promise<EmailResult> {
  const { subject, html, text } = buildFindMyOrdersEmail(orders);
  return sendEmail(email, subject, text, html);
}

export async function sendThankYouEmail(order: CateringOrderWithItems): Promise<EmailResult> {
  const { subject, html, text } = buildThankYouEmail(order);
  return sendEmail(order.contactEmail, subject, text, html);
}

export async function sendOwnerNewRequestEmail(
  order: CateringOrderWithItems,
  db?: Db,
  options: SendOptions = {},
): Promise<EmailResult> {
  const { subject, html, text } = buildOwnerNewRequestEmail(order);
  return sendEmail(await ownerEmail(db), `${options.subjectPrefix ?? ""}${subject}`, text, html);
}

// ---------------------------------------------------------------------------
// Admin preview page support
// ---------------------------------------------------------------------------

function sampleOrder(): CateringOrderWithItems {
  const now = new Date("2026-09-27T12:00:00-07:00");
  const eventAt = new Date("2026-10-02T12:30:00-07:00");
  const respondBy = new Date("2026-09-29T10:14:00-07:00");
  const items: CateringOrderItem[] = [
    {
      id: "sample-item-1",
      orderId: "sample-order",
      position: 0,
      itemId: "sliders-fries",
      itemName: "Sliders and Fries",
      qty: 30,
      wayId: "chriss-way",
      wayLabel: "Chris's Way",
      toppings: ["lettuce", "tomato", "sauce", "raw-onion"],
      toppingLabels: ["Lettuce", "Tomato", "Sauce", "Raw Onion"],
      extras: [],
      extraLabels: [],
      unitCents: 1749,
      amountCents: 52470,
      forName: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "sample-item-2",
      orderId: "sample-order",
      position: 1,
      itemId: "grilled-cheese",
      itemName: "Grilled Cheese",
      qty: 1,
      wayId: null,
      wayLabel: null,
      toppings: [],
      toppingLabels: [],
      extras: [],
      extraLabels: [],
      unitCents: 400,
      amountCents: 400,
      forName: "Priya S.",
      note: "Vegetarian: clean spot on the griddle",
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    id: "sample-order",
    number: "CAT-1042",
    token: "sample-token-1234567890",
    status: "requested",
    store: "vannuys",
    fulfilment: "delivery",
    eventAt,
    headcount: null,
    contactName: "Maya Torres",
    contactEmail: "maya@example.com",
    contactPhone: "(818) 555-0142",
    company: "Northlight Pictures",
    poNumber: "NL-4471",
    onsiteContactName: null,
    onsiteContactPhone: null,
    address: {
      line1: "Stage 4, gate B",
      line2: null,
      city: "Van Nuys",
      state: "CA",
      zip: "91406",
      instructions: null,
    },
    distanceMiles: "3.2",
    rangeUnknown: false,
    plateSets: 60,
    foodCents: 113250,
    deliveryCents: 2500,
    taxCents: 11042,
    tipCents: 11325,
    totalCents: 138117,
    refundedCents: 0,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeCustomerId: null,
    stripePaymentMethodId: null,
    requestedAt: now,
    respondBy,
    approvedAt: null,
    declinedAt: null,
    declineReason: null,
    cancelledAt: null,
    expiresAt: null,
    customerNote: null,
    ownerNote: null,
    pendingChange: null,
    createdAt: now,
    updatedAt: now,
    items,
  };
}

/** The same hand-built sample order the previews use, addressed to
 * `contactEmail` — the "Send test emails" button sends the real "Request
 * received" and "New catering request" emails against it. */
export function sampleOrderFor(contactEmail: string): CateringOrderWithItems {
  return { ...sampleOrder(), contactEmail };
}

export type CateringEmailPreview = { id: string; label: string; content: CateringEmailContent };

/** Every catering email, built once against one hand-built sample order, for
 * `/admin/catering/emails/` — the owner previews every wording before
 * ordering is turned on (see the build plan's ground rules). No database
 * involved. */
export function renderCateringEmailPreviews(): CateringEmailPreview[] {
  const order = sampleOrder();
  return [
    {
      id: "request-received",
      label: "Request received",
      content: buildRequestReceivedEmail(order),
    },
    { id: "booked", label: "You're booked", content: buildBookedEmail(order) },
    {
      id: "declined",
      label: "Declined",
      content: buildDeclinedEmail(order, "We're already booked that day."),
    },
    { id: "expired", label: "Expired", content: buildExpiredEmail(order) },
    { id: "cancelled", label: "Cancelled", content: buildCancelledEmail(order, order.totalCents) },
    { id: "change-received", label: "Change received", content: buildChangeReceivedEmail(order) },
    { id: "change-approved", label: "Change approved", content: buildChangeApprovedEmail(order) },
    {
      id: "change-declined",
      label: "Change declined",
      content: buildChangeDeclinedEmail(order, "That day is already fully booked."),
    },
    {
      id: "find-my-orders",
      label: "Find my orders",
      content: buildFindMyOrdersEmail([
        { number: order.number, token: order.token, eventAt: order.eventAt },
      ]),
    },
    { id: "thank-you", label: "Thank you", content: buildThankYouEmail(order) },
    {
      id: "owner-new-request",
      label: "Owner: new request",
      content: buildOwnerNewRequestEmail(order),
    },
  ];
}

/** Whether catering email sending is configured — the admin preview page
 * uses this to tell the owner previews are drafts vs. that sending is live. */
export { isEmailConfigured };
