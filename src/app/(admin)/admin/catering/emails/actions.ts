"use server";

import { getDb } from "@/db/client";
import { requireOwner, resolveClientIp } from "@/lib/auth";
import { sendCateringTestEmails, type SendTestEmailsResult } from "@/lib/catering/testEmails";

export type SendTestEmailsState = (SendTestEmailsResult & { at: string }) | undefined;

/** `/admin/catering/emails/`'s "Send test emails" button — see
 * `sendCateringTestEmails` for what it sends and how it is rate limited. */
export async function sendTestEmailsAction(): Promise<SendTestEmailsState> {
  const session = await requireOwner();
  const db = await getDb();
  const result = await sendCateringTestEmails(db, session.email, await resolveClientIp());
  return { ...result, at: new Date().toISOString() };
}
