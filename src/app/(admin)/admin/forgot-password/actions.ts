"use server";

/**
 * Starts an owner password reset. Delegates to Better Auth's own
 * `requestPasswordReset` (`auth.api.requestPasswordReset({ body: { email,
 * redirectTo } })` — confirmed against `node_modules/better-auth/dist/api/
 * routes/password.d.mts`), which already responds identically whether or
 * not `email` belongs to an account (see that route's handler: an unknown
 * address short-circuits into the exact same `{ status: true, message }` an
 * owner gets, after simulating the same token-generation and lookup work so
 * the timing doesn't give it away either). This action only has to avoid
 * *adding* a distinction Better Auth doesn't already have — so every path
 * through it, including a thrown error, returns the one generic
 * `GENERIC_MESSAGE` — except the one case that's about this site's own
 * configuration, not about any address: Resend not being set up at all.
 *
 * Throttled the same way `signIn` throttles sign-in
 * (`src/lib/signInThrottle.ts`), on both the submitted email and the caller's
 * IP, but under its own `"password_reset"` `kind` — a distinct bucket in the
 * shared `sign_in_attempts` table so flooding this form can never lock an
 * owner out of signing in, and vice versa. The throttle message is decided
 * purely from `checkThrottle`'s answer for (email, ip), before Better Auth is
 * even asked whether the address exists, so it stays exactly as
 * enumeration-proof as `GENERIC_MESSAGE`: identical for a known and an
 * unknown address.
 */
import { getDb } from "@/db/client";
import { resolveClientIp } from "@/lib/auth";
import { getAuth } from "@/lib/betterAuth";
import { checkThrottle, pruneSignInAttempts, recordSignInAttempt } from "@/lib/signInThrottle";

export type ForgotPasswordState = {
  sent?: boolean;
  message?: string;
  error?: string;
};

const GENERIC_MESSAGE = "If that address belongs to an owner, a reset link is on its way.";
const TOO_MANY_ATTEMPTS_MESSAGE = "Too many requests for that address. Try again later.";

/** Separates this throttle from owner sign-in in the shared
 * `sign_in_attempts` table — see `src/lib/signInThrottle.ts`. */
const PASSWORD_RESET_KIND = "password_reset";

/** True once RESEND_API_KEY and EMAIL_FROM are both set — the same pair
 * `src/lib/setupChecklist.ts` checks for its "Email" checklist item, read
 * directly here (rather than importing that module) so this action stays
 * self-contained. Checked directly against `process.env`, per the task: not
 * inferred from whether `requestPasswordReset` succeeded, since Better
 * Auth's `sendResetPassword` hook fires in the background and never reports
 * its `{ sent, reason }` result back to this call. */
function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter your email address." };

  // This is the one legitimately different response — it's about the
  // site's own configuration, not about whether `email` belongs to an
  // owner, so it doesn't leak anything an attacker could use.
  if (!isEmailConfigured()) {
    return {
      error:
        "Emailing isn't set up for this site yet, so no reset link can be sent. Ask whoever manages deployment to set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  const db = await getDb();
  const ip = await resolveClientIp();
  const now = new Date();

  await pruneSignInAttempts(db, now);

  const throttle = await checkThrottle(db, email, ip, now, PASSWORD_RESET_KIND);
  if (throttle.locked) {
    // Recorded like every other request below — see the comment there —
    // so a locked visitor who keeps hammering the form doesn't reset their
    // own retry window.
    await recordSignInAttempt(db, email, ip, false, now, PASSWORD_RESET_KIND);
    console.warn("[forgot-password] request throttled", {
      email,
      ip,
      emailFailures: throttle.emailFailures,
      ipFailures: throttle.ipFailures,
    });
    return { error: TOO_MANY_ATTEMPTS_MESSAGE };
  }

  const auth = await getAuth();
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/admin/reset-password" },
    });
  } catch (err) {
    // Better Auth's own handler doesn't throw just because the address is
    // unknown — see the module comment above — so anything landing here is
    // something else (a malformed address, a database hiccup). Swallowed
    // rather than surfaced, so this path still can't be told apart from
    // success.
    console.error("[forgot-password] requestPasswordReset failed", err);
  }

  // Recorded as a failure unconditionally — unlike sign-in, there's no safe
  // "succeeded" signal here (that would mean an unknown address never counts
  // toward the limit, since it can never truly "succeed"), and
  // `checkThrottle` only counts `succeeded: false` rows. Fixing this to
  // `false` is what makes every request, known address or not, count toward
  // the same 5-per-15-minutes limit sign-in uses.
  await recordSignInAttempt(db, email, ip, false, now, PASSWORD_RESET_KIND);

  return { sent: true, message: GENERIC_MESSAGE };
}
