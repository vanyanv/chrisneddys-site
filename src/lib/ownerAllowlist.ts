/**
 * Parses `OWNER_EMAILS` (comma-separated) into a normalised list: trimmed,
 * lowercased, empty entries dropped. Pulled out of `src/lib/auth.ts` so it
 * can be unit tested without pulling in Next's server-only APIs.
 */
export function parseOwnerEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
