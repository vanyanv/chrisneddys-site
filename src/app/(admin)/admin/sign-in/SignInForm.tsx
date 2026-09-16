"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/(admin)/admin/actions";

const initialState: SignInState = {};

/** The board's "That password didn't match. **3 tries left** before a
 * cool-down." warning — issue #44. The actual wording stays whatever
 * `signInAction` returns (a deliberately generic "that email or password
 * isn't right", so a wrong guess never tells an attacker which half was
 * wrong); only the tries-left clause is added on top of it. */
function TriesLeftWarning({ message, remaining }: { message: string; remaining: number }) {
  return (
    <div className="rack-guest-warning" role="alert">
      <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
        <path d="M8 5v4M8 11.2v.1" />
        <circle cx="8" cy="8" r="6" />
      </svg>
      <span>
        {message}{" "}
        <strong>
          {remaining} {remaining === 1 ? "try" : "tries"} left
        </strong>{" "}
        before a cool-down.
      </span>
    </div>
  );
}

export function SignInForm({
  next,
  justReset = false,
  sessionExpired = false,
}: {
  next: string;
  justReset?: boolean;
  sessionExpired?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const locked = typeof state.retryAfterSeconds === "number";

  return (
    <form action={formAction} className="rack-guest-card" noValidate>
      <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
      <h1 className="rack-bow rack-guest-title">Sign in.</h1>
      <p className="rack-guest-lede">Two owners. Nobody else gets in.</p>

      {justReset ? (
        <p className="rack-guest-banner">Password updated. Sign in with your new password.</p>
      ) : sessionExpired ? (
        <p className="rack-guest-banner">
          You were signed out. Sessions last 12 hours &mdash; sign in again to keep going.
        </p>
      ) : null}

      <input type="hidden" name="next" value={next} />

      <div className="adm-field">
        <label className="adm-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="adm-field">
        <label className="adm-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" className="rack-btn-primary rack-guest-submit" disabled={pending}>
        {pending ? (
          <>
            <span className="rack-spin" aria-hidden="true" />
            Signing in&hellip;
          </>
        ) : (
          "Sign in"
        )}
      </button>

      {state.error ? (
        locked ? (
          <p className="adm-error" role="alert">
            Too many attempts. Try again in a few minutes.
          </p>
        ) : typeof state.remainingAttempts === "number" && state.remainingAttempts > 0 ? (
          <TriesLeftWarning message={state.error} remaining={state.remainingAttempts} />
        ) : (
          <p className="adm-error" role="alert">
            {state.error}
          </p>
        )
      ) : null}

      <div className="rack-hairline rack-guest-link-row">
        <Link href="/admin/forgot-password">Trouble getting in?</Link>
        <span className="rack-eyebrow">5 tries per 15 min</span>
      </div>
    </form>
  );
}
