/**
 * Transactional email — order confirmation, shipping notice, pickup-ready,
 * password reset, owner invite — sent through Resend's REST API with plain
 * `fetch` (no SDK: one endpoint, one shape, not worth a dependency). Gated
 * on `RESEND_API_KEY` and `EMAIL_FROM` both being set; without them nothing
 * is sent, the attempt is logged, and the caller gets
 * `{ sent: false, reason }` back rather than a thrown error — a missing
 * Resend key must never fail the webhook that marks an order paid, or the
 * auth flow that resets a password or invites an owner.
 *
 * Transactional only, in the brand's plain, direct voice: what was bought,
 * what it cost, what happens next, who to ask. No marketing content, no
 * unsubscribe footer — these are receipts, not a list.
 */
import "server-only";
import { getDb, type Db } from "@/db/client";
import { brand } from "@/data/brand";
import { getEditionSizes, getStoreSettings, type OrderWithItems } from "@/lib/orders";

export type EmailResult = { sent: true } | { sent: false; reason: string };

type OrderItem = OrderWithItems["items"][number];

function centsToPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

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

function fulfilmentLines(order: OrderWithItems, settings: { pickupAddress: string }): string[] {
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
  settings: { pickupAddress: string; returnsPolicy: string | null; supportEmail: string },
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

/** Turns the same plain-text body into a minimal HTML document — one
 * `<pre>` block, no layout to maintain in two places and drift apart. */
function htmlBody(text: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;white-space:pre-wrap;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">${escapeHtml(text)}</body></html>`;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
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
      body: JSON.stringify({ from, to, subject, text, html: htmlBody(text) }),
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

  const text = textBody(`Thanks for your order from ${brand.name}.`, order, sizes, settings, [
    order.fulfilment === "pickup"
      ? "We'll email you again the moment it's ready to pick up."
      : "We'll email you again with tracking once it ships.",
  ]);

  return sendEmail(order.email ?? "", `Order ${order.number} confirmed — ${brand.name}`, text);
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

  const tracking =
    order.carrier && order.trackingNumber
      ? [`Carrier: ${order.carrier}`, `Tracking number: ${order.trackingNumber}`]
      : [];

  const text = textBody(
    `Your order from ${brand.name} has shipped.`,
    order,
    sizes,
    settings,
    tracking,
  );

  return sendEmail(order.email ?? "", `Order ${order.number} has shipped — ${brand.name}`, text);
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
