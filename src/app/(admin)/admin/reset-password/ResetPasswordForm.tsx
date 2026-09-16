"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

/** Matches `resetPasswordAction`'s own `MIN_PASSWORD_LENGTH` — kept as a
 * separate constant here (rather than importing a server action file into
 * a client component) the same way the board itself just draws the number. */
const MIN_PASSWORD_LENGTH = 12;
const STRENGTH_BAR_COUNT = 4;

type StrengthLevel = "weak" | "fair" | "strong";

/** A purely advisory client-side estimate — length plus a little character
 * variety — never a claim about what the server enforces. The one rule
 * this codebase actually backs (12 characters minimum) is stated
 * separately, in the checklist below. */
function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function strengthLevel(score: number): StrengthLevel {
  if (score <= 1) return "weak";
  if (score <= 2) return "fair";
  return "strong";
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <path d="M3 8.5l3.2 3.2L13 4.5" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const score = useMemo(() => passwordScore(password), [password]);
  const level = strengthLevel(score);
  const longEnough = password.length >= MIN_PASSWORD_LENGTH;
  const matches = confirmPassword.length > 0 && password === confirmPassword;

  if (state.expired) {
    return (
      <div className="rack-guest-card">
        <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
        <h1 className="rack-bow rack-guest-title">Reset password.</h1>
        <p className="adm-notice">{state.error}</p>
        <p className="adm-notice">
          <Link href="/admin/forgot-password">Request a new reset link</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="rack-guest-card" noValidate>
      <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
      <h1 className="rack-bow rack-guest-title">
        New
        <br />
        password.
      </h1>
      <p className="rack-guest-lede">
        This signs out every other device you&rsquo;re logged in on.
      </p>

      <input type="hidden" name="token" value={token} />

      <div className="adm-field">
        <label className="adm-label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="rack-strength-bars" aria-hidden="true">
        {Array.from({ length: STRENGTH_BAR_COUNT }, (_, i) => (
          <span key={i} className={i < score ? `is-filled level-${level}` : ""} />
        ))}
      </div>

      <div className="rack-rules-list">
        <div className={longEnough ? "rack-rule-item is-met" : "rack-rule-item"}>
          {longEnough ? <CheckIcon /> : <CircleIcon />}
          At least {MIN_PASSWORD_LENGTH} characters
        </div>
      </div>

      <div className="adm-field">
        <label className="adm-label" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      <div className="rack-rules-list">
        <div className={matches ? "rack-rule-item is-met" : "rack-rule-item"}>
          {matches ? <CheckIcon /> : <CircleIcon />}
          Passwords match
        </div>
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
            Setting password&hellip;
          </>
        ) : (
          "Set password and sign in"
        )}
      </button>
    </form>
  );
}
