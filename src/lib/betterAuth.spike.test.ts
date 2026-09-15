/**
 * Proves the five assumptions the Better Auth migration is blocked on — see
 * "Assumptions the spike must prove" in
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`.
 * Every `it()` below states the finding in its name; each is a real
 * assertion against a PGlite-backed instance, not a console.log.
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getSessionCookie } from "better-auth/cookies";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { hashPassword, verifyPassword } from "@/lib/password";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

/** Hashes `password` the old way: scrypt N=16384, r=8, p=1, 64-byte key —
 * what every stored owner password looked like before this migration. */
async function legacyHash(password: string): Promise<string> {
  const scryptAsync = promisify(scrypt) as unknown as (
    password: string,
    salt: Buffer,
    keylen: number,
    options: Record<string, unknown>,
  ) => Promise<Buffer>;
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

describe("A1: auth.api.* works called directly, with no /api/auth/* route ever mounted", () => {
  it("signInEmail, getSession and changePassword all succeed from plain server-side calls", async () => {
    const auth = await getAuth();
    const email = "a1-owner@example.com";
    const password = "correct horse battery staple";

    await auth.api.signUpEmail({ body: { name: "A1 Owner", email, password } });

    const signInResponse = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(signInResponse.status).toBe(200);
    const cookiePair = signInResponse.headers.get("set-cookie")?.split(";")[0];
    expect(cookiePair).toBeTruthy();
    const headers = new Headers({ cookie: cookiePair! });

    const session = await auth.api.getSession({ headers });
    expect(session?.user.email).toBe(email);

    const newPassword = "a brand new owner password!!";
    const changed = await auth.api.changePassword({
      headers,
      body: { currentPassword: password, newPassword },
    });
    expect(changed.user.email).toBe(email);

    // The change actually took effect: old password is refused, new one works.
    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toThrow();
    const reSignIn = await auth.api.signInEmail({ body: { email, password: newPassword } });
    expect(reSignIn.user.email).toBe(email);
  });
});

describe("A2: a password-reset link works for an account created WITHOUT a password", () => {
  it('finding: TRUE — requestPasswordReset + resetPassword creates the credential account on the fly, so an invite is just "create user, send reset"', async () => {
    const db = await getDb();
    // A mutable box, not a reassigned `let` — TypeScript's control-flow
    // narrowing doesn't track assignments made from inside a callback, so a
    // plain `let captured = null` reassigned only inside `sendResetPassword`
    // narrows to `null` for every read after it, even once the callback has
    // actually run.
    const captured: { value: { url: string; token: string } | null } = { value: null };

    // A dedicated instance (same db, adapter, and hasher as src/lib/betterAuth.ts)
    // with a `sendResetPassword` callback that captures the token instead of
    // emailing it — this task doesn't touch src/lib/email.ts, so the shipped
    // instance has no sender configured yet.
    const invitesAuth = betterAuth({
      secret: "test-secret-a2",
      database: drizzleAdapter(db, { provider: "pg", schema }),
      emailAndPassword: {
        enabled: true,
        password: {
          hash: hashPassword,
          verify: ({ hash, password }) => verifyPassword(password, hash),
        },
        sendResetPassword: async ({ url, token }) => {
          captured.value = { url, token };
        },
      },
    });

    const email = "invited-owner@example.com";
    // The shape of an invite: a `user` row with no matching `account` row at
    // all, i.e. no password of any kind — not even an empty one.
    await db.insert(schema.user).values({
      id: "invited-owner-id",
      name: "Invited Owner",
      email,
      emailVerified: false,
    });

    const requested = await invitesAuth.api.requestPasswordReset({ body: { email } });
    expect(requested.status).toBe(true);
    expect(captured.value?.token).toBeTruthy();

    await invitesAuth.api.resetPassword({
      body: { token: captured.value!.token, newPassword: "a brand new invite password!" },
    });

    const signedIn = await invitesAuth.api.signInEmail({
      body: { email, password: "a brand new invite password!" },
    });
    expect(signedIn.user.email).toBe(email);
  });
});

describe("A3: the async Drizzle adapter can be a module-level singleton, not built per request", () => {
  it("finding: a lazy singleton — getAuth() memoizes the built instance, so concurrent callers never build it twice", async () => {
    const [first, second] = await Promise.all([getAuth(), getAuth()]);
    expect(first).toBe(second);

    const third = await getAuth();
    expect(third).toBe(first);
  });
});

describe("A4: a custom password.hash/verify is honoured by Better Auth", () => {
  it("hashPassword is what Better Auth stores on sign-up (current 4-field format)", async () => {
    const auth = await getAuth();
    const db = await getDb();
    const email = "a4-current@example.com";
    await auth.api.signUpEmail({
      body: { name: "A4 Owner", email, password: "another long password!!" },
    });

    const [account] = await db.query.account.findMany({
      where: (t, { eq }) => eq(t.providerId, "credential"),
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit: 1,
    });
    expect(account?.password).toMatch(/^scrypt\$131072\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it("a legacy 3-field hash, stored directly on the account row, verifies through Better Auth and signs the owner in", async () => {
    const db = await getDb();
    const email = "a4-legacy@example.com";
    const password = "legacy password for owner";

    await db.insert(schema.user).values({
      id: "a4-legacy-id",
      name: "Legacy Owner",
      email,
      emailVerified: false,
    });
    await db.insert(schema.account).values({
      id: "a4-legacy-account-id",
      accountId: "a4-legacy-id",
      providerId: "credential",
      userId: "a4-legacy-id",
      password: await legacyHash(password),
    });

    const auth = await getAuth();
    const result = await auth.api.signInEmail({ body: { email, password } });
    expect(result.user.email).toBe(email);

    // Confirm this only worked because verify() truly evaluated the legacy
    // hash — the wrong password against the same legacy row still fails.
    await expect(
      auth.api.signInEmail({ body: { email, password: "wrong password" } }),
    ).rejects.toThrow();
  });
});

describe("A5: the edge-safe way to read the session cookie in middleware", () => {
  it("finding: better-auth/cookies' getSessionCookie() reads cookie presence with no db or auth-instance import", async () => {
    const auth = await getAuth();
    const email = "a5-owner@example.com";
    const password = "another password for a5!!";
    await auth.api.signUpEmail({ body: { name: "A5 Owner", email, password } });
    const signInResponse = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    const cookiePair = signInResponse.headers.get("set-cookie")!.split(";")[0]!;

    const requestWithCookie = new Request("http://localhost/admin", {
      headers: { cookie: cookiePair },
    });
    const requestWithoutCookie = new Request("http://localhost/admin");

    // getSessionCookie is imported straight from "better-auth/cookies" in
    // this file, never from "@/lib/betterAuth" (the Node-only instance) —
    // this call needs neither that module nor a database round-trip.
    expect(getSessionCookie(requestWithCookie)).toEqual(expect.any(String));
    expect(getSessionCookie(requestWithoutCookie)).toBeNull();
  });
});
