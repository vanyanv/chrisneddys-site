"use client";

import { useEffect, useRef, useState } from "react";
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { passkeySignInFinishAction, passkeySignInStartAction } from "@/app/(admin)/admin/actions";

/**
 * "Continue with a passkey" — the primary action on the sign-in card
 * (issue #51's boards). Renders nothing until `browserSupportsWebAuthn()`
 * resolves `true` on mount, so a browser with no WebAuthn support at all
 * (or a non-secure context) just shows the password form below with no gap
 * where this would have been — the device-loss/unsupported-browser fallback
 * is "this button never appears", not an error state.
 *
 * A cancelled or failed ceremony (no passkey on this device, the user
 * dismissed the prompt, a timeout) is deliberately swallowed rather than
 * surfaced as an error: the password form right below this is always fully
 * usable, and a scary red banner over "you just clicked the wrong button"
 * would only get in its way. Only a *server-side* rejection — the throttle,
 * or an assertion that failed verification — shows the shared generic
 * error, identical in wording to a wrong password.
 */
export function PasskeySignIn({ next }: { next: string }) {
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stays true for the rest of this page's life: the cool-down outlasts any
  // retry the owner could usefully make, so re-enabling the button would
  // only invite attempts that are certain to fail — and each one is another
  // recorded attempt.
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  // Conditional UI: offer saved passkeys in the email field's autofill list.
  // Uses the same discoverable-credential options and finish action as the
  // button. SimpleWebAuthn cancels this pending request when the button starts
  // its own ceremony; the form's submit and unmount cancel it explicitly.
  // An aborted or dismissed request is silent.
  const buttonStarted = useRef(false);
  useEffect(() => {
    let active = true;
    let finishing = false;
    (async () => {
      try {
        if (!(await browserSupportsWebAuthnAutofill())) return;
        const start = await passkeySignInStartAction();
        // The button may have started its own ceremony (and challenge) while
        // this was loading; starting autofill now would abort it.
        if (!active || !start.ok || buttonStarted.current) return;
        const response = await startAuthentication({
          optionsJSON: start.options,
          useBrowserAutofill: true,
        });
        if (!active) return;
        finishing = true;
        setPending(true);
        await finish(response);
        setPending(false);
      } catch {
        // Aborted (the button took over), dismissed, or unsupported: silent,
        // and only this path's own "pending" is cleared, never the button's.
        if (active && finishing) setPending(false);
      }
    })();
    return () => {
      active = false;
      WebAuthnAbortService.cancelCeremony();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supported) return null;

  async function finish(response: AuthenticationResponseJSON) {
    const result = await passkeySignInFinishAction(response, next);
    // A successful finish redirects server-side and never returns here —
    // reaching this line means it didn't.
    if (typeof result?.retryAfterSeconds === "number") {
      // The same wording the password form shows for the same lockout
      // (`SignInForm`), because it is the same throttle on the same
      // table. Without this a locked-out owner was told their credential
      // was wrong and left free to keep trying — which is the exact
      // thing issue #45 was about: warn before the lock, not after.
      setError("Too many attempts. Try again in a few minutes.");
      setLocked(true);
      return;
    }
    if (result?.error) setError(result.error);
  }

  async function handleClick() {
    buttonStarted.current = true;
    setError(null);
    setPending(true);
    try {
      const start = await passkeySignInStartAction();
      if (!start.ok) {
        setError(start.error);
        return;
      }

      let response;
      try {
        response = await startAuthentication({ optionsJSON: start.options });
      } catch {
        // Cancelled, timed out, or no passkey available here — not an
        // error, just "use the password below instead".
        return;
      }

      await finish(response);
    } catch {
      setError("Couldn't sign in with a passkey. Try again, or use your password below.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rack-guest-passkey">
      <button
        type="button"
        className="rack-btn-primary rack-guest-submit"
        onClick={handleClick}
        disabled={pending || locked}
      >
        {pending ? (
          <>
            <span className="rack-spin" aria-hidden="true" />
            Checking&hellip;
          </>
        ) : (
          <>
            <svg aria-hidden="true" className="rack-icon" viewBox="0 0 24 24">
              <circle cx="8" cy="12" r="4.2" />
              <path d="M12 12h9M17.5 12v4M20.5 12v3" />
            </svg>
            Continue with a passkey
          </>
        )}
      </button>
      <p className="rack-guest-passkey-caption">
        Face ID or your laptop&rsquo;s fingerprint reader.
      </p>

      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}

      <div className="rack-guest-divider" role="separator">
        <span className="rack-guest-divider-line" aria-hidden="true" />
        <span className="rack-eyebrow">or use a password</span>
        <span className="rack-guest-divider-line" aria-hidden="true" />
      </div>
    </div>
  );
}
