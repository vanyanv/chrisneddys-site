/**
 * Owner-password hashing, isolated from `src/lib/auth.ts` so it can be unit
 * tested without pulling in Next's server-only cookie/redirect APIs.
 *
 * Two generations of stored hash exist, both produced by Node's built-in
 * `crypto.scrypt`, both a 64-byte derived key:
 *
 * - **legacy** (3 fields): `scrypt$<saltHex>$<hashHex>` at N=16384, r=8, p=1.
 *   This was the only format before
 *   `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`.
 * - **current** (4 fields): `scrypt$131072$<saltHex>$<hashHex>` at
 *   N=131072 (OWASP's current floor), r=8, p=1. `hashPassword` only ever
 *   produces this format now.
 *
 * `verifyPassword` accepts either and stays a plain `Promise<boolean>` so its
 * existing call sites (`src/lib/auth.ts:118,150`) keep working unchanged;
 * `verifyPasswordDetailed` is the same check but also reports which
 * generation matched, so a later task can rehash a legacy hash to the
 * current format on a successful sign-in.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const LEGACY_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const CURRENT_N = 131072;
const CURRENT_PARAMS = { N: CURRENT_N, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

// `util.promisify`'s generic overloads are matched by arity against
// `crypto.scrypt`'s own overloads, and it resolves to the (password, salt,
// keylen, callback) form — the one with no options object — losing the N/r/p
// tuning (and `maxmem`) entirely. Asserting the real shape here is simpler
// than fighting that resolution.
type ScryptParams = { N: number; r: number; p: number };
type ScryptAsync = (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptParams & { maxmem: number },
) => Promise<Buffer>;
const scryptAsync = promisify(scrypt) as unknown as ScryptAsync;

/**
 * Node's default `maxmem` is 32 MiB, and scrypt needs (approximately)
 * `128 * N * r` bytes to run — 16 MiB at the legacy N=16384, but 128 MiB at
 * the current N=131072, comfortably over that default. Passing too small a
 * `maxmem` doesn't get slower or degrade some other way, it makes
 * `crypto.scrypt` throw ("Invalid maxmem" / "invalid options") outright —
 * proven in `password.test.ts`. Doubling the requirement leaves headroom
 * without hard-coding a fixed value that would silently stop being enough if
 * `N` or `r` ever changes.
 */
function maxmemFor(params: ScryptParams): number {
  return 128 * params.N * params.r * 2;
}

function deriveKey(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH, { ...params, maxmem: maxmemFor(params) });
}

/** Hashes `password` into the current `scrypt$131072$<saltHex>$<hashHex>` storage format. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, CURRENT_PARAMS);
  return `scrypt$${CURRENT_N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

type ParsedHash = {
  params: ScryptParams;
  generation: "legacy" | "current";
  salt: Buffer;
  expected: Buffer;
};

/**
 * Parses either stored form; null for anything else (wrong scheme, wrong
 * field count, a non-numeric cost field, or an `N` this codebase doesn't
 * produce).
 */
function parseStoredHash(stored: string): ParsedHash | null {
  const fields = stored.split("$");

  if (fields.length === 3) {
    const [scheme, saltHex, hashHex] = fields;
    if (scheme !== "scrypt" || !saltHex || !hashHex) return null;
    return {
      params: LEGACY_PARAMS,
      generation: "legacy",
      salt: Buffer.from(saltHex, "hex"),
      expected: Buffer.from(hashHex, "hex"),
    };
  }

  if (fields.length === 4) {
    const [scheme, costStr, saltHex, hashHex] = fields;
    const N = Number(costStr);
    if (scheme !== "scrypt" || !saltHex || !hashHex || !Number.isInteger(N) || N !== CURRENT_N) {
      return null;
    }
    return {
      params: { N, r: CURRENT_PARAMS.r, p: CURRENT_PARAMS.p },
      generation: "current",
      salt: Buffer.from(saltHex, "hex"),
      expected: Buffer.from(hashHex, "hex"),
    };
  }

  return null;
}

export type PasswordVerifyResult = { ok: boolean; generation: "legacy" | "current" | null };

/**
 * Verifies `password` against a stored hash of either generation, and
 * reports which one matched (null when the stored value didn't parse at
 * all, or the password was wrong). Always runs a real scrypt derivation —
 * at the current, more expensive parameters when the stored value is
 * malformed — so a caller looping over allowlist checks and password checks
 * takes comparable time on every failure path — see `signIn` in
 * `src/lib/auth.ts`.
 */
export async function verifyPasswordDetailed(
  password: string,
  stored: string,
): Promise<PasswordVerifyResult> {
  const parsed = parseStoredHash(stored);
  // A dummy salt/hash of the right shape, run at the current (expensive)
  // parameters, so an unrecognised stored value still spends a real scrypt
  // call before returning false.
  const salt = parsed?.salt ?? randomBytes(16);
  const params = parsed?.params ?? CURRENT_PARAMS;
  const expected = parsed?.expected ?? randomBytes(KEY_LENGTH);

  const actual = await deriveKey(password, salt, params);
  if (!parsed || actual.length !== expected.length) return { ok: false, generation: null };
  const ok = timingSafeEqual(actual, expected);
  return { ok, generation: ok ? parsed.generation : null };
}

/**
 * Verifies `password` against a stored hash of either generation. A thin
 * boolean wrapper over `verifyPasswordDetailed` for callers (`src/lib/
 * auth.ts`) that only need the yes/no answer.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return (await verifyPasswordDetailed(password, stored)).ok;
}
