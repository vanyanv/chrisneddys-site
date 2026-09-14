#!/usr/bin/env node
/**
 * Prints an `OWNER_PASSWORD_HASH=` line for the given password. Never stores
 * anything — paste the printed line into `.env.local` / the deploy env
 * yourself.
 *
 * Usage: pnpm owner:password <password>
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

const password = process.argv[2];
if (!password) {
  console.error("Usage: pnpm owner:password <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
console.log(`OWNER_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${key.toString("hex")}`);
