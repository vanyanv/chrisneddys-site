/**
 * The order emails' HTML body: a single-column, table-based layout built
 * from the same order data as the plain-text body in `emailOrderText.ts`.
 */
import { holdColors } from "@/lib/emailColor";
import { emailLogoImg } from "@/lib/emailLogo";
import type { OrderWithItems } from "@/lib/orders";
import { centsToPrice, type OrderItem, type Settings } from "@/lib/emailOrderText";

export function escapeHtml(s: string): string {
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

export function htmlItemRow(item: OrderItem, sizes: Map<string, number | null>): string {
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

export function htmlTotals(order: OrderWithItems, totalLabel: string): string {
  const rows = [htmlMoneyRow("Subtotal", order.subtotalCents)];
  if (order.shippingCents > 0) rows.push(htmlMoneyRow("Shipping", order.shippingCents));
  if (order.taxCents > 0) rows.push(htmlMoneyRow("Tax", order.taxCents));
  rows.push(htmlMoneyRow(totalLabel, order.totalCents, { bold: true }));
  return rows.join("");
}

export function htmlInfoBox(label: string, bodyHtml: string): string {
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${RULE};background:${PAPER}"><tr><td style="padding:12px 14px">
    <div style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:bold;color:${MUTED};margin-bottom:5px">${escapeHtml(label)}</div>
    <div style="font-family:${MONO_FONT};font-size:12px;line-height:1.7;color:${INK}">${bodyHtml}</div>
  </td></tr></table>`;
  return row(inner, "padding-top:14px");
}

/** The "Going to" / pickup box — the HTML counterpart of `fulfilmentLines`. */
export function htmlFulfilmentBox(order: OrderWithItems, settings: Settings): string {
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

export function htmlButton(href: string, label: string): string {
  const link = `<a href="${escapeHtml(href)}" style="display:inline-block;background:${YELLOW};border:1px solid ${YELLOW_DEEP};color:${INK};font-family:${DISPLAY_FONT};font-weight:bold;font-size:13px;letter-spacing:.02em;padding:12px 26px;text-decoration:none">${escapeHtml(label)}</a>`;
  return row(link, "padding:18px 0 4px;text-align:center");
}

export function htmlNote(text: string): string {
  return row(
    `<p style="margin:0;font-family:${BODY_FONT};font-size:11.5px;color:${MUTED};text-align:center;line-height:1.6">${escapeHtml(text)}</p>`,
    "padding-top:14px",
  );
}

export function htmlShell(opts: {
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

  return holdColors(`<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD};border:1px solid ${RULE}">
      <tr><td style="background:${headBg};padding:14px 20px">
        ${pair(
          emailLogoImg(headColor),
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
</html>`);
}
