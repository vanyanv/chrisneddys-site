import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { InferInsertModel } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { MAX_FAILED_ATTEMPTS, checkThrottle } from "@/lib/signInThrottle";

// Same mocking shape as `src/lib/auth.test.ts` — see its comments for why
// both are needed outside a real Next.js request. `headers()` here is
// mutable per-test (`setRequestHeaders`) so a test can hand a real session
// cookie to the functions under test, exactly the way the browser would
// carry it from one server action call to the next.
vi.mock("server-only", () => ({}));

let requestHeaders = new Headers();
function setRequestHeaders(h: Headers): void {
  requestHeaders = h;
}

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
  headers: async () => requestHeaders,
}));

const {
  listOwnerPasskeys,
  listPasskeysForEmail,
  startPasskeyEnrollment,
  removeOwnerPasskey,
  finishPasskeySignIn,
} = await import("@/lib/passkeys");

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

/** Signs `email` up and in through the real Better Auth instance, and
 * returns `Headers` carrying its session cookie — the same shape
 * `betterAuth.spike.test.ts` builds. */
async function signedInHeaders(email: string, password: string): Promise<Headers> {
  const auth = await getAuth();
  await auth.api.signUpEmail({ body: { name: email, email, password } });
  const signInResponse = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookiePair = signInResponse.headers.get("set-cookie")?.split(";")[0];
  return new Headers({ cookie: cookiePair! });
}

/** Inserts a passkey row directly, bypassing the real WebAuthn ceremony —
 * these tests aren't exercising `@simplewebauthn/server`'s signature
 * verification (that's Better Auth's own concern, and the e2e suite's
 * virtual-authenticator specs drive the real thing end to end). This is
 * only ever used to set up state for `listOwnerPasskeys`/`removeOwnerPasskey`
 * and for the "credential ID belongs to a real owner" half of the throttle. */
async function insertRawPasskey(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  overrides: Partial<InferInsertModel<typeof schema.passkey>> = {},
): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.passkey).values({
    id,
    userId,
    publicKey: "unused-in-these-tests",
    credentialID: overrides.credentialID ?? randomUUID(),
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
    ...overrides,
  });
  return id;
}

describe("listOwnerPasskeys", () => {
  it("is empty with no session at all", async () => {
    setRequestHeaders(new Headers());
    await expect(listOwnerPasskeys()).resolves.toEqual([]);
  });

  it("lists only the signed-in owner's own passkeys, newest first, with a display-name fallback", async () => {
    const db = await getDb();
    const email = "passkey-list-owner@example.com";
    const headers = await signedInHeaders(email, "correct password for list test!!");
    const [owner] = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, email) });

    setRequestHeaders(headers);
    await expect(listOwnerPasskeys()).resolves.toEqual([]);

    await insertRawPasskey(db, owner!.id, { name: "  MacBook  " });
    // A known AAGUID (from `commonAuthenticatorNames`) with no owner-supplied
    // name falls back to that provider's name, not the raw GUID.
    await insertRawPasskey(db, owner!.id, {
      aaguid: "08987058-cadc-4b81-b6e1-30de50dcbe96",
    });
    // Neither a name nor a recognizable AAGUID: falls back to "Passkey".
    await insertRawPasskey(db, owner!.id);

    // A different owner's passkey must never show up in this list.
    const otherEmail = "passkey-list-other-owner@example.com";
    await signedInHeaders(otherEmail, "someone else's password!!");
    const [otherOwner] = await db.query.user.findMany({
      where: (t, { eq }) => eq(t.email, otherEmail),
    });
    await insertRawPasskey(db, otherOwner!.id, { name: "Not mine" });

    setRequestHeaders(headers);
    const list = await listOwnerPasskeys();
    expect(list).toHaveLength(3);
    expect(list.map((p) => p.name)).toEqual(["Passkey", "Windows Hello", "MacBook"]);
    expect(list.every((p) => p.name !== "Not mine")).toBe(true);
  });
});

describe("listPasskeysForEmail", () => {
  /**
   * What `/admin/settings` actually renders from. It takes the email the
   * page already resolved instead of re-deriving a session the way
   * `listOwnerPasskeys` does, so it has to be proven separately that it
   * scopes to that one owner — the session middleware isn't there to do it.
   */
  it("returns the owner's own passkeys, newest first, and nobody else's", async () => {
    const db = await getDb();
    const mine = "passkeys-by-email-mine@example.com";
    const theirs = "passkeys-by-email-theirs@example.com";
    await signedInHeaders(mine, "a long enough password!!");
    await signedInHeaders(theirs, "a long enough password!!");

    const [mineUser] = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, mine) });
    const [theirsUser] = await db.query.user.findMany({
      where: (t, { eq }) => eq(t.email, theirs),
    });

    await insertRawPasskey(db, mineUser!.id, {
      name: "Older",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertRawPasskey(db, mineUser!.id, {
      name: "Newer",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    await insertRawPasskey(db, theirsUser!.id, { name: "Not yours" });

    const rows = await listPasskeysForEmail(mine);
    expect(rows.map((row) => row.name)).toEqual(["Newer", "Older"]);
  });

  it("agrees with the session-based read for the same owner", async () => {
    // These two must never drift: one renders the card on the server, the
    // other refreshes it after every add and remove. If they disagreed, the
    // list would change the moment you touched it.
    const db = await getDb();
    const email = "passkeys-by-email-agree@example.com";
    const headers = await signedInHeaders(email, "a long enough password!!");
    const [owner] = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, email) });
    await insertRawPasskey(db, owner!.id, { name: "Shared view" });

    setRequestHeaders(headers);
    expect(await listPasskeysForEmail(email)).toEqual(await listOwnerPasskeys());
  });

  it("is empty for an address with no account at all", async () => {
    await expect(listPasskeysForEmail("nobody-at-all@example.com")).resolves.toEqual([]);
  });
});

describe("startPasskeyEnrollment", () => {
  it("refuses to start with no session (issue #51 rule 2)", async () => {
    setRequestHeaders(new Headers());
    const result = await startPasskeyEnrollment();
    expect(result.ok).toBe(false);
  });

  it("returns real registration options for a signed-in owner", async () => {
    const headers = await signedInHeaders(
      "passkey-enroll-owner@example.com",
      "correct password for enroll test!!",
    );
    setRequestHeaders(headers);

    const result = await startPasskeyEnrollment("My device");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.options.challenge).toBe("string");
      expect(result.options.challenge.length).toBeGreaterThan(0);
    }
  });
});

describe("removeOwnerPasskey", () => {
  it("removes a passkey the signed-in owner actually owns", async () => {
    const db = await getDb();
    const email = "passkey-remove-owner@example.com";
    const headers = await signedInHeaders(email, "correct password for remove test!!");
    const [owner] = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, email) });
    const id = await insertRawPasskey(db, owner!.id);

    setRequestHeaders(headers);
    await expect(removeOwnerPasskey(id)).resolves.toEqual({ ok: true });

    const remaining = await db.query.passkey.findMany({ where: (t, { eq }) => eq(t.id, id) });
    expect(remaining).toHaveLength(0);
  });

  it("removing the owner's last passkey still succeeds — the password keeps working (issue #51 rule 3)", async () => {
    const db = await getDb();
    const email = "passkey-remove-last-owner@example.com";
    const headers = await signedInHeaders(email, "correct password for last passkey test!!");
    const [owner] = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, email) });
    const id = await insertRawPasskey(db, owner!.id);

    setRequestHeaders(headers);
    await expect(removeOwnerPasskey(id)).resolves.toEqual({ ok: true });
    await expect(listOwnerPasskeys()).resolves.toEqual([]);

    // The password path is untouched by any of this.
    const auth = await getAuth();
    const reSignIn = await auth.api.signInEmail({
      body: { email, password: "correct password for last passkey test!!" },
    });
    expect(reSignIn.user.email).toBe(email);
  });

  it("never deletes a passkey belonging to a different owner", async () => {
    const db = await getDb();
    const victimEmail = "passkey-remove-victim@example.com";
    await signedInHeaders(victimEmail, "victim's password!!");
    const [victim] = await db.query.user.findMany({
      where: (t, { eq }) => eq(t.email, victimEmail),
    });
    const victimPasskeyId = await insertRawPasskey(db, victim!.id);

    const attackerHeaders = await signedInHeaders(
      "passkey-remove-attacker@example.com",
      "attacker's password!!",
    );
    setRequestHeaders(attackerHeaders);
    const result = await removeOwnerPasskey(victimPasskeyId);
    expect(result.ok).toBe(false);

    const stillThere = await db.query.passkey.findMany({
      where: (t, { eq }) => eq(t.id, victimPasskeyId),
    });
    expect(stillThere).toHaveLength(1);
  });
});

describe("finishPasskeySignIn: throttle (issue #51 rule 5)", () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-passkey-throttle";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  });

  it("charges a bogus assertion for a real credential ID to that owner's own email channel", async () => {
    const db = await getDb();
    const email = "passkey-signin-known-cred@example.com";
    await signedInHeaders(email, "the real password!!");
    const [owner] = await db.query.user.findMany({ where: (t, { eq }) => eq(t.email, email) });
    const credentialID = randomUUID();
    await insertRawPasskey(db, owner!.id, { credentialID });

    setRequestHeaders(new Headers());
    const ip = "203.0.113.90";
    const result = await finishPasskeySignIn(
      {
        id: credentialID,
        rawId: credentialID,
        response: {},
        clientExtensionResults: {},
        type: "public-key",
      } as never,
      ip,
    );
    expect(result.ok).toBe(false);

    const status = await checkThrottle(db, email, ip);
    expect(status.emailFailures).toBe(1);
  });

  it("charges an unrecognized credential ID to a per-IP key, never a shared literal", async () => {
    const db = await getDb();
    const ip = "203.0.113.91";
    const bogusId = randomUUID();

    const result = await finishPasskeySignIn(
      {
        id: bogusId,
        rawId: bogusId,
        response: {},
        clientExtensionResults: {},
        type: "public-key",
      } as never,
      ip,
    );
    expect(result.ok).toBe(false);

    const status = await checkThrottle(db, `passkey-unknown:${ip}`, ip);
    expect(status.emailFailures).toBe(1);
    expect(status.ipFailures).toBe(1);
  });

  it("locks out after MAX_FAILED_ATTEMPTS bogus attempts from the same IP, with the same generic error a wrong password gets", async () => {
    const ip = "203.0.113.92";

    let last: Awaited<ReturnType<typeof finishPasskeySignIn>> | undefined;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      const bogusId = randomUUID();
      last = await finishPasskeySignIn(
        {
          id: bogusId,
          rawId: bogusId,
          response: {},
          clientExtensionResults: {},
          type: "public-key",
        } as never,
        ip,
      );
    }
    expect(last?.ok).toBe(false);

    const sixthBogusId = randomUUID();
    const locked = await finishPasskeySignIn(
      {
        id: sixthBogusId,
        rawId: sixthBogusId,
        response: {},
        clientExtensionResults: {},
        type: "public-key",
      } as never,
      ip,
    );
    expect(locked).toMatchObject({ ok: false, retryAfterSeconds: expect.any(Number) });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe("That email or password isn't right.");
  });
});
