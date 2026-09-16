/**
 * The sign-in lockout policy, as plain numbers.
 *
 * This module exists so the sign-in screen can state the policy without
 * being able to state it wrongly. `src/lib/signInThrottle.ts` owns the
 * behaviour, but it imports `@/db/schema` — so a client component can't
 * read its constants, and `SignInForm` ended up with "5 tries per 15 min"
 * typed out by hand beside a throttle that happened to agree. Change
 * either number there and the sign-in screen would have gone on promising
 * the old one, which is the same defect as the run panel telling every
 * owner their edition was fifty.
 *
 * Deliberately importless, the same way `src/lib/publishRequirements.ts`
 * is: anything imported here lands in the client bundle.
 */

/** Failed attempts allowed within `LOCKOUT_WINDOW_MS` before the lockout. */
export const MAX_FAILED_ATTEMPTS = 5;

/** How long the window is, and so how long a lockout lasts. */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** "5 tries per 15 min" — the sign-in card's own summary of the two above,
 * built from them rather than written out beside them. */
export function signInPolicySummary(): string {
  return `${MAX_FAILED_ATTEMPTS} tries per ${LOCKOUT_WINDOW_MS / 60_000} min`;
}

/**
 * How long a password-reset link stays valid, in seconds.
 *
 * #44 draws 30 minutes. This shipped at 60 first, because Better Auth's
 * `resetPasswordTokenExpiresIn` defaults to 3600s and the copy was changed
 * to match the code rather than the other way round — which made the
 * drawing wrong instead of the build. Passing this into `betterAuth.ts`
 * and rendering the same number on the forgot-password panel means the
 * link's real lifetime and the sentence describing it cannot disagree:
 * the previous constant lived in the client component alone, so the
 * config was still free to drift out from under it.
 */
export const RESET_LINK_EXPIRY_SECONDS = 30 * 60;

/** The same window in whole minutes, for copy that says "30 minutes". */
export const RESET_LINK_EXPIRY_MINUTES = RESET_LINK_EXPIRY_SECONDS / 60;
