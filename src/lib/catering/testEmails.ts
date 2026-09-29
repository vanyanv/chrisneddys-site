/**
 * The "Send test emails" button on `/admin/catering/emails/`: sends the
 * sample "New catering request" (owner) and "Request received" (customer)
 * emails, both addressed to the catering owner email, through the exact same
 * send functions a real order uses (`sendOwnerNewRequestEmail`,
 * `sendRequestReceivedEmail`) — only the subject gets a "[TEST] " prefix.
 * That is the point: the owner sees how a real order lands in their inbox
 * through Resend.
 *
 * Kept out of the server action so it can be unit tested against PGlite.
 * Rate limited to one send per minute across the whole site, recorded in
 * `sign_in_attempts` under its own `kind` (same table and pattern as the
 * other throttles — see `src/lib/signInThrottle.ts`).
 */
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "@/db/client";
import { signInAttempts } from "@/db/schema";
import { isEmailConfigured, type EmailResult } from "@/lib/email";
import { recordSignInAttempt } from "@/lib/signInThrottle";
import { sampleOrderFor, sendOwnerNewRequestEmail, sendRequestReceivedEmail } from "./emails";
import { getCateringSettings } from "./settings";

export const TEST_EMAIL_KIND = "catering_test_email";
export const TEST_EMAIL_COOLDOWN_MS = 60 * 1000;
export const TEST_SUBJECT_PREFIX = "[TEST] ";

export type TestEmailLine = { label: string; sent: boolean; message: string };

export type SendTestEmailsResult =
  | { ok: true; to: string; lines: TestEmailLine[] }
  | { ok: false; error: string };

function missingEmailConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.EMAIL_FROM) missing.push("EMAIL_FROM");
  return missing;
}

function line(label: string, result: EmailResult, to: string): TestEmailLine {
  return result.sent
    ? { label, sent: true, message: `Sent to ${to}.` }
    : { label, sent: false, message: result.reason };
}

export async function sendCateringTestEmails(
  db: Db,
  requestedBy: string,
  ip: string,
  now: Date = new Date(),
): Promise<SendTestEmailsResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: `Email isn't set up: missing ${missingEmailConfig().join(" or ")}.`,
    };
  }

  const recent = await db
    .select({ id: signInAttempts.id })
    .from(signInAttempts)
    .where(
      and(
        eq(signInAttempts.kind, TEST_EMAIL_KIND),
        gte(signInAttempts.attemptedAt, new Date(now.getTime() - TEST_EMAIL_COOLDOWN_MS)),
      ),
    )
    .limit(1);
  if (recent.length > 0) {
    return { ok: false, error: "Test emails were just sent. Wait a minute and try again." };
  }
  await recordSignInAttempt(db, requestedBy, ip, true, now, TEST_EMAIL_KIND);

  const settings = await getCateringSettings(db);
  const to = settings.ownerEmail;
  const order = sampleOrderFor(to);
  const options = { subjectPrefix: TEST_SUBJECT_PREFIX };

  const ownerResult = await sendOwnerNewRequestEmail(order, db, options);
  const customerResult = await sendRequestReceivedEmail(order, options);

  return {
    ok: true,
    to,
    lines: [
      line("New catering request (owner email)", ownerResult, to),
      line("Request received (customer email)", customerResult, to),
    ],
  };
}
