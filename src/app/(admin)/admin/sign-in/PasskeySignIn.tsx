"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
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

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  if (!supported) return null;

  async function handleClick() {
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

      const result = await passkeySignInFinishAction(response, next);
      // A successful finish redirects server-side and never returns here —
      // reaching this line means it didn't.
      if (result?.error) setError(result.error);
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
        disabled={pending}
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
