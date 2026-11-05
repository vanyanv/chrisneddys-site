/**
 * Two cheap screens on a contact-form message that sort it, never drop it:
 * a real catering request that trips one of them still arrives, just with a
 * tag at the front of the subject so a mail rule can file it.
 *
 * - **Sales pitch** — the message reads like a cold pitch (funding, SEO, "10
 *   minutes of your time"). Not applied to "Order issue", where "I waited 10
 *   minutes" is a customer, not a pitch.
 * - **Likely bot** — the message box was pasted into in one go, almost no
 *   keys pressed in it, and the whole form was sent within seconds of the
 *   page opening. Or the submission came without the typing record the form
 *   always sends, which means it didn't come from the form. Phone keyboards,
 *   autofill and voice typing can look like pasting, which is why this tags
 *   and doesn't block.
 *
 * Pure: the contact action (`siteForms.ts`) reads the fields, this decides.
 */

/** Phrases that mark a cold sales pitch. Whole words, any case. Kept short
 * on purpose: each one has to be rare in a real customer message. */
const SALES_PITCH = [
  /\bqualify for\b/i,
  /\bpre-?approved\b/i,
  /\bfunding\b/i,
  /\bbusiness loans?\b/i,
  /\bline of credit\b/i,
  /\bmerchant cash advance\b/i,
  /\bworking capital\b/i,
  /\bSEO\b/i,
  /\bsearch engine optimi[sz]ation\b/i,
  /\b(first page|page one|top) of google\b/i,
  /\blead generation\b/i,
  /\b(5|10|15|five|ten|fifteen)[ -]minutes?\b/i,
  /\bquick (call|chat)\b/i,
  /\bbook a (call|demo|meeting)\b/i,
];

export function looksLikeSalesPitch(topic: string, message: string): boolean {
  if (topic === "Order issue") return false;
  return SALES_PITCH.some((re) => re.test(message));
}

/** Under this long from the page opening to Send, with the message pasted
 * in, reads as a script. A person filling in a name and an email first
 * rarely gets there this fast. */
const FAST_MS = 15_000;

/**
 * Why the typing record looks automated, in words for the owner's email, or
 * null when it looks like a person. `keys` and `openMs` are the raw form
 * fields: how many keys were pressed in the message box, and how long the
 * page had been open when Send was pressed.
 */
export function automatedReason(message: string, keys: string, openMs: string): string | null {
  if (!/^\d+$/.test(keys) || !/^\d+$/.test(openMs)) {
    return "Sent without the form's typing record, so not from the page itself.";
  }
  const pressed = Number(keys);
  const ms = Number(openMs);
  if (pressed * 10 < message.length && ms < FAST_MS) {
    const secs = Math.max(1, Math.round(ms / 1000));
    return `Message pasted in whole (${pressed} key${pressed === 1 ? "" : "s"} pressed), sent ${secs} second${secs === 1 ? "" : "s"} after the page opened.`;
  }
  return null;
}
