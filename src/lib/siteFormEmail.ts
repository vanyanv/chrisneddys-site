/**
 * The emails the site's two public forms send to the owner's inbox — the
 * contact form and the opening-list signup (`src/lib/siteForms.ts` sends
 * them). Pure builders: data in, `{ subject, text, html }` out, so the
 * layout can be tested and previewed without Resend.
 *
 * Laid out for reading on a phone between tickets: the topic first, as a
 * label; who wrote and when; the message itself in a box; then big tap
 * targets to answer by email or phone. Same paper-and-ink look and the same
 * table-based, web-safe-font construction as the order emails in
 * `src/lib/email.ts` (no image, no webfont, nothing that has to load), and
 * every piece the visitor typed is escaped before it touches the HTML.
 */
import { brand } from "@/data/brand";

export type BuiltEmail = { subject: string; text: string; html: string };

const PAPER = "#fff8e7";
const CREAM = "#fff2c9";
const CARD = "#fffdf6";
const INK = "#1a1612";
const RULE = "#e3d8bc";
const MUTED = "#6f6857";
const YELLOW = "#f5b82e";
const SIGNAL_RED = "#d0281c";
const DISPLAY_FONT = "'Arial Black', Impact, 'Franklin Gothic Bold', sans-serif";
const MONO_FONT = "'JetBrains Mono', 'Courier New', Courier, monospace";
const BODY_FONT = "Arial, Helvetica, sans-serif";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/** Subject lines are one line: a newline typed into a name must not reach a
 * mail header. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

/** "Thu 9/24 · 11:12 AM" in Los Angeles time — when the visitor pressed
 * send, in the restaurant's own clock, whatever timezone the server is on. */
export function laStamp(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("month")}/${get("day")} · ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

/** Digits (and a leading +) only, for a `tel:` link. Empty when there is
 * nothing dialable in what was typed. */
function dialable(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.replace(/\D/g, "").length >= 7 ? cleaned : "";
}

function firstNameOf(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function mailtoHref(to: string, subject: string): string {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}`;
}

function button(href: string, label: string, primary: boolean): string {
  const style = primary
    ? `background:${YELLOW};border:2px solid ${INK};color:${INK}`
    : `background:${CARD};border:2px solid ${INK};color:${INK}`;
  return `<a href="${escapeHtml(href)}" style="display:block;${style};font-family:${DISPLAY_FONT};font-weight:bold;font-size:14px;letter-spacing:.02em;padding:14px 12px;text-align:center;text-decoration:none">${escapeHtml(label)}</a>`;
}

function detailRow(label: string, valueHtml: string): string {
  return `<tr>
    <td style="padding:9px 0;border-top:1px solid ${RULE};font-family:${MONO_FONT};font-size:10px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;color:${MUTED};width:72px;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:9px 0;border-top:1px solid ${RULE};font-family:${BODY_FONT};font-size:14px;color:${INK};word-break:break-word">${valueHtml}</td>
  </tr>`;
}

function link(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${INK};text-decoration:underline">${escapeHtml(text)}</a>`;
}

function shell(opts: {
  label: string;
  urgent: boolean;
  heading: string;
  stamp: string;
  bodyHtml: string;
  buttonsHtml: string[];
  note: string;
}): string {
  const pill = opts.urgent
    ? `background:${SIGNAL_RED};color:${CREAM};border:2px solid ${INK}`
    : `background:${YELLOW};color:${INK};border:2px solid ${INK}`;
  const buttons = opts.buttonsHtml
    .map((b) => `<tr><td style="padding-top:10px">${b}</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:20px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${CARD};border:2px solid ${INK}">
      <tr><td style="background:${INK};padding:12px 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${DISPLAY_FONT};font-size:16px;color:${PAPER}">${escapeHtml(brand.name)}</td>
          <td align="right" style="font-family:${MONO_FONT};font-size:10px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase;color:${PAPER}">Website</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 18px 22px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td><span style="display:inline-block;${pill};font-family:${MONO_FONT};font-size:11px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;padding:5px 11px">${escapeHtml(opts.label)}</span></td></tr>
          <tr><td style="padding-top:14px"><h1 style="margin:0;font-family:${DISPLAY_FONT};font-weight:bold;font-size:22px;line-height:1.2;color:${INK}">${escapeHtml(opts.heading)}</h1></td></tr>
          <tr><td style="padding-top:6px;font-family:${MONO_FONT};font-size:11px;letter-spacing:.06em;color:${MUTED}">${escapeHtml(opts.stamp)}</td></tr>
          ${opts.bodyHtml}
          ${buttons}
          <tr><td style="padding-top:16px;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:${MUTED};text-align:center">${escapeHtml(opts.note)}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

export function contactEmail(
  input: { name: string; email: string; phone: string; topic: string; message: string },
  at: Date = new Date(),
): BuiltEmail {
  const { name, email, phone, topic, message } = input;
  const first = firstNameOf(name);
  const stamp = laStamp(at);
  const subject = `[${topic}] ${oneLine(name)} — chrisneddys.com`;
  const tel = dialable(phone);

  const text = [
    `${topic.toUpperCase()}`,
    `${name} wrote in through the website, ${stamp}.`,
    "",
    message,
    "",
    `Email: ${email}`,
    `Phone: ${phone || "not given"}`,
    "",
    `Hit Reply to answer ${first}.`,
  ].join("\n");

  const bodyHtml = `
    <tr><td style="padding-top:16px">
      <div style="background:${PAPER};border:1px solid ${RULE};border-left:4px solid ${INK};padding:14px 16px;font-family:${BODY_FONT};font-size:15px;line-height:1.55;color:${INK};white-space:pre-wrap;word-break:break-word">${escapeHtml(message)}</div>
    </td></tr>
    <tr><td style="padding-top:14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Name", escapeHtml(name))}
        ${detailRow("Email", link(`mailto:${email}`, email))}
        ${detailRow("Phone", tel ? link(`tel:${tel}`, phone) : `<span style="color:${MUTED}">Not given</span>`)}
      </table>
    </td></tr>`;

  const buttons = [
    button(mailtoHref(email, `Re: ${topic}`), `REPLY TO ${first.toUpperCase()}`, true),
  ];
  if (tel) buttons.push(button(`tel:${tel}`, `CALL ${phone}`, false));

  const html = shell({
    label: topic,
    urgent: topic === "Order issue",
    heading: `${name} wrote in.`,
    stamp,
    bodyHtml,
    buttonsHtml: buttons,
    note: `Hitting Reply in your inbox answers ${first} too.`,
  });

  return { subject, text, html };
}

export function openingListEmail(
  input: { email: string; hood: string },
  at: Date = new Date(),
): BuiltEmail {
  const { email, hood } = input;
  const stamp = laStamp(at);
  const subject = `[Opening list — ${hood}] ${email}`;

  const text = [
    `OPENING LIST · ${hood.toUpperCase()}`,
    `Someone wants to know when ${hood} opens. Signed up ${stamp}.`,
    "",
    `Email: ${email}`,
    "",
    "Keep this address for the opening announcement.",
  ].join("\n");

  const bodyHtml = `
    <tr><td style="padding-top:14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Email", link(`mailto:${email}`, email))}
        ${detailRow("Location", escapeHtml(hood))}
      </table>
    </td></tr>`;

  const html = shell({
    label: `Opening list · ${hood}`,
    urgent: false,
    heading: `Someone wants to know when ${hood} opens.`,
    stamp,
    bodyHtml,
    buttonsHtml: [button(mailtoHref(email, `${brand.name} ${hood}`), "EMAIL THEM", true)],
    note: "Keep this address for the opening announcement.",
  });

  return { subject, text, html };
}
