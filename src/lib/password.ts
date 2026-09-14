/**
 * Owner-password hashing, isolated from `src/lib/auth.ts` so it can be unit
 * tested without pulling in Next's server-only cookie/redirect APIs.
 *
 * Format: `scrypt$<saltHex>$<hashHex>`, produced by Node's built-in
 * `crypto.scrypt` with N=16384, r=8, p=1, a 64-byte derived key. There is no
 * third-party auth service here — this is the entire credential story for
 * the shared owner password (`scripts/owner-password.mjs` is the only place
 * that ever prints one of these strings).
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

// `util.promisify`'s generic overloads are matched by arity against
// `crypto.scrypt`'s own overloads, and it resolves to the (password, salt,
// keylen, callback) form — the one with no options object — losing the N/r/p
// tuning entirely. Asserting the real shape here is simpler than fighting
// that resolution.
type ScryptAsync = (
  password: string,
  salt: Buffer,
  keylen: number,
  options: typeof SCRYPT_PARAMS,
) => Promise<Buffer>;
const scryptAsync = promisify(scrypt) as unknown as ScryptAsync;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
}

/** Hashes `password` into the `scrypt$<saltHex>$<hashHex>` storage format. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Parses `scrypt$<saltHex>$<hashHex>`; null for anything else. */
function parseStoredHash(stored: string): { salt: Buffer; expected: Buffer } | null {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return null;
  return { salt: Buffer.from(saltHex, "hex"), expected: Buffer.from(hashHex, "hex") };
}

/**
 * Verifies `password` against a stored `scrypt$<saltHex>$<hashHex>` hash.
 * Always runs the scrypt derivation (even for a malformed hash) so a caller
 * looping over allowlist checks and password checks takes the same time on
 * every failure path — see `signIn` in `src/lib/auth.ts`.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  // A dummy salt/hash of the right shape, so an unrecognised stored value
  // still spends a scrypt call before returning false.
  const salt = parsed?.salt ?? randomBytes(16);
  const expected = parsed?.expected ?? randomBytes(KEY_LENGTH);

  const actual = await deriveKey(password, salt);
  if (!parsed || actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
