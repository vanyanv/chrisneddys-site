#!/usr/bin/env node
/**
 * Owner password hashes.
 *
 * Default: hashes the given password and PRINTS an `OWNER_PASSWORD_HASH=`
 * line for you to paste into `.env.local` / the deploy env by hand. Never
 * stores anything. This is only read on an owner's very first sign-in, to
 * seed their account — see "Owner accounts" in DEPLOY.md.
 *
 *   pnpm owner:password <password>
 *
 * `--apply` is the break-glass path for a locked-out owner: it connects to
 * the database directly and sets that owner's password on the spot, without
 * a redeploy. The email must already have a `user` row (they signed in
 * before, or were invited) — this never creates an owner.
 *
 *   pnpm owner:password --apply <email> <password>
 */
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
// Matches src/lib/password.ts: scrypt N=131072 (OWASP's current floor for
// scrypt), r=8, p=1, a 64-byte derived key. scrypt's working set is
// roughly 128 * N * r bytes (~128MB here), well past Node's default 32MB
// `maxmem`, so it has to be raised or `crypto.scrypt` throws.
const SCRYPT_N = 131072;
const SCRYPT_PARAMS = { N: SCRYPT_N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 12;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

function usage() {
  console.error("Usage: pnpm owner:password <password>");
  console.error("       pnpm owner:password --apply <email> <password>");
}

async function applyPassword(email, password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Refusing: password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error(
      "Refusing: DATABASE_URL is not set. --apply writes to the real " +
        "database, so it won't guess which one — set DATABASE_URL to the " +
        "same connection string the deploy uses and try again.",
    );
    process.exit(1);
  }

  // Imported lazily, after the checks above, so `--apply` with no
  // DATABASE_URL fails instantly instead of paying for a database module
  // load first.
  const { sql } = await import("drizzle-orm");
  const { getDb } = await import("../src/db/client.ts");
  const db = await getDb();

  const users = await db
    .execute(sql`select id from "user" where email = ${email} limit 1`)
    .then((result) => result.rows);
  const user = users[0];
  if (!user) {
    console.error(
      `Refusing: no user with email "${email}". Invite them first (Settings ` +
        "> Owners), or let OWNER_EMAILS + OWNER_PASSWORD_HASH seed their " +
        'account on first sign-in — see "Owner accounts" in DEPLOY.md.',
    );
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const existing = await db
    .execute(
      sql`select id from "account" where user_id = ${user.id} and provider_id = 'credential' limit 1`,
    )
    .then((result) => result.rows);

  if (existing[0]) {
    await db.execute(
      sql`update "account" set password = ${hash}, updated_at = now() where id = ${existing[0].id}`,
    );
  } else {
    await db.execute(
      sql`insert into "account" (id, user_id, provider_id, account_id, password, created_at, updated_at)
          values (${randomUUID()}, ${user.id}, 'credential', ${user.id}, ${hash}, now(), now())`,
    );
  }

  console.log(`Password set for ${email}. Other devices stay signed in — this is not a revoke.`);
  process.exit(0);
}

const args = process.argv.slice(2);

if (args[0] === "--apply") {
  const [, email, password] = args;
  if (!email || !password) {
    usage();
    process.exit(1);
  }
  await applyPassword(email, password);
} else {
  const password = args[0];
  if (!password) {
    usage();
    process.exit(1);
  }
  console.log(`OWNER_PASSWORD_HASH=${await hashPassword(password)}`);
}
