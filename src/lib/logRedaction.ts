/**
 * Keeps addresses out of application logs.
 *
 * The sign-in and passkey paths log every failed and throttled attempt,
 * which is worth having: it is how a locked-out owner's problem gets
 * diagnosed. What they do not need is the whole address. The addresses
 * that reach these lines are not only owners' — a mistyped one puts some
 * unrelated person's email into the log, and the log is shipped to the
 * host's aggregator, with its own retention and access rules. The
 * `signInAttempt` table already stores what the throttle actually needs.
 *
 * Domain is kept: with a handful of owners it is enough to tell which
 * account a line is about, and it is what distinguishes an owner's typo
 * from someone else's traffic. The IP stays in the log untouched — the
 * throttle locks on it, so a line without it cannot explain a lockout.
 */

/**
 * `owner@example.com` -> `o***@example.com`. Anything without a single
 * `@` — notably the passkey path's `passkey-unknown:<ip>` sentinel, which
 * is a throttle key rather than an address — is returned unchanged.
 */
export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@") || at === email.length - 1) return email;
  return `${email[0]}***${email.slice(at)}`;
}
