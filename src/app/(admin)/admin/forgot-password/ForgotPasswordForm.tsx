"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

/** Matches Better Auth's `resetPasswordTokenExpiresIn` default (3600
 * seconds — see `src/lib/betterAuth.ts`, which doesn't override it). Kept
 * as one constant so this copy and that config can't quietly drift apart
 * again the way the drawn board's "30 minutes" already had. */
const RESET_LINK_EXPIRY_MINUTES = 60;

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <path d="M3 8.5l3.2 3.2L13 4.5" />
    </svg>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  // Held only so "Send it again" can resubmit without retyping — never
  // read to decide anything server-side.
  const [email, setEmail] = useState("");
  // `useActionState`'s `state` is replaced wholesale on every submit, so a
  // throttled "Send it again" (returns `{ error }`, no `sent`) would
  // otherwise flip this whole panel back to the empty request form —
  // losing the fact that a link genuinely did go out earlier. Once the
  // confirmation has been shown, it stays shown; a failed resend surfaces
  // its error inline instead of un-confirming the first send.
  const [everSent, setEverSent] = useState(false);
  // The message from the *first* successful send — kept around so a later
  // throttled resend (which returns no `message` of its own) doesn't blank
  // this line out.
  const [sentMessage, setSentMessage] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (state.sent) {
      setEverSent(true);
      setSentMessage(state.message);
    }
  }, [state.sent, state.message]);

  if (everSent) {
    const resendFailed = !pending && !state.sent && Boolean(state.error);
    return (
      <div className="rack-guest-card">
        <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
        <h1 className="rack-bow rack-guest-title">
          Check your
          <br />
          inbox.
        </h1>
        <p className="rack-guest-lede">
          {sentMessage} It works once, and it expires in {RESET_LINK_EXPIRY_MINUTES} minutes.
        </p>

        <form action={formAction}>
          <input type="hidden" name="email" value={email} />
          <div className={pending ? "rack-guest-notice" : "rack-guest-notice is-done"}>
            {pending ? (
              <>
                <span className="rack-spin" aria-hidden="true" />
                <span>Sending&hellip;</span>
              </>
            ) : (
              <>
                <CheckIcon />
                <span>Link sent</span>
              </>
            )}
          </div>
          {pending ? (
            <div className="rack-edbar">
              <i className="rack-sweep" style={{ width: "100%" }} />
            </div>
          ) : null}

          <div className="rack-hairline">
            <span style={{ fontSize: 13, color: "var(--rack-muted)" }}>
              Nothing after a minute?{" "}
              <button type="submit" className="rack-link-button" disabled={pending}>
                Send it again
              </button>
            </span>
          </div>
          {resendFailed ? (
            <p className="adm-error" role="alert">
              {state.error}
            </p>
          ) : null}
        </form>

        <p className="rack-guest-privacy">
          We never email you a password, and we never say whether an address has an account. Both on
          purpose.
        </p>

        <Link href="/admin/sign-in" className="rack-btn rack-guest-back">
          <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="rack-guest-card" noValidate>
      <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
      <h1 className="rack-bow rack-guest-title">Forgot password?</h1>
      <p className="rack-guest-lede">
        Enter your email. If it belongs to an owner, we&rsquo;ll send a link to reset the password.
      </p>

      <div className="adm-field">
        <label className="adm-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {state.error ? (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="rack-btn-primary rack-guest-submit" disabled={pending}>
        {pending ? (
          <>
            <span className="rack-spin" aria-hidden="true" />
            Sending&hellip;
          </>
        ) : (
          "Send reset link"
        )}
      </button>

      <p className="adm-notice">
        <Link href="/admin/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
