"use client";

import { useActionState } from "react";
import { sendTestEmailsAction, type SendTestEmailsState } from "./actions";

/** "Send test emails to <owner email>" — see `sendCateringTestEmails`. */
export function SendTestEmails({ ownerEmail }: { ownerEmail: string }) {
  const [state, formAction, pending] = useActionState<SendTestEmailsState, FormData>(
    sendTestEmailsAction,
    undefined,
  );

  return (
    <form action={formAction} className="cat-test-send">
      <button type="submit" className="rack-btn" disabled={pending}>
        {pending ? "Sending…" : `Send test emails to ${ownerEmail}`}
      </button>
      <p className="adm-help">
        Sends the &ldquo;New catering request&rdquo; and &ldquo;Request received&rdquo; emails for a
        sample order, exactly the way a real order sends them, with &ldquo;[TEST]&rdquo; at the
        start of the subject.
      </p>
      <div aria-live="polite">
        {state && !state.ok && (
          <p className="adm-error" role="alert">
            {state.error}
          </p>
        )}
        {state?.ok &&
          state.lines.map((l) =>
            l.sent ? (
              <p key={l.label} className="adm-help" data-test-email="sent">
                Sent: {l.label}. {l.message}
              </p>
            ) : (
              <p key={l.label} className="adm-error" role="alert" data-test-email="failed">
                Not sent: {l.label}. {l.message}
              </p>
            ),
          )}
      </div>
    </form>
  );
}
