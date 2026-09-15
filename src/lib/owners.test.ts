/**
 * Covers `src/lib/owners.ts`'s three rules (last owner, self-removal,
 * duplicate invite), the `user` -> `session`/`account` cascade delete
 * (migration `0006`), and — since it's the same "revoke every other
 * session" guarantee the change-password card depends on — Better Auth's
 * `changePassword` with `revokeOtherSessions: true`, called the same way
 * `src/app/(admin)/admin/settings/actions.ts` calls it.
 */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { inviteOwner, listOwners, removeOwner } from "@/lib/owners";

// `owners.ts` carries `import "server-only"`, which throws outside a real
// Next.js server build — see the same note in `src/lib/email.test.ts`.
vi.mock("server-only", () => ({}));

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

/** Inserts a bare owner `user` row directly (no `account`) — the shape
 * `inviteOwner` itself produces, and the cheapest way to seed a second
 * owner for tests that don't care how they got there. */
async function insertOwner(email: string, name = "Owner"): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name, email, emailVerified: false });
  return id;
}

describe("listOwners", () => {
  it("marks the row matching currentEmail as isYou, case-insensitively", async () => {
    await insertOwner("list-a@example.com", "A");
    await insertOwner("list-b@example.com", "B");

    const rows = await listOwners("LIST-B@example.com");
    const a = rows.find((r) => r.email === "list-a@example.com");
    const b = rows.find((r) => r.email === "list-b@example.com");

    expect(a?.isYou).toBe(false);
    expect(b?.isYou).toBe(true);
  });
});

describe("inviteOwner", () => {
  it("creates a user row with no account row, and reports the email couldn't be sent (Resend unconfigured in tests)", async () => {
    const email = "invite-new@example.com";

    const result = await inviteOwner(email);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.sent).toBe(false);
    if (result.sent) throw new Error("unreachable");
    expect(result.reason).toBeTruthy();
    expect(result.url).toContain("/reset-password/");

    const db = await getDb();
    const [row] = await db.select().from(schema.user).where(eq(schema.user.email, email));
    expect(row).toBeTruthy();

    const accounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, row!.id));
    expect(accounts).toHaveLength(0);
  });

  it("refuses an email that already has an owner account, without creating a duplicate row", async () => {
    const email = "invite-dupe@example.com";
    await insertOwner(email);

    const result = await inviteOwner(email);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toMatch(/already has an owner account/i);

    const db = await getDb();
    const rows = await db.select().from(schema.user).where(eq(schema.user.email, email));
    expect(rows).toHaveLength(1);
  });

  it("rejects an invalid email address without touching the database", async () => {
    const result = await inviteOwner("not-an-email");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toMatch(/valid email/i);
  });
});

describe("removeOwner", () => {
  it("refuses to remove the last remaining owner", async () => {
    const db = await getDb();
    // Isolate: delete every existing user first, so this test's "only one
    // owner" premise holds regardless of what earlier tests inserted.
    await db.delete(schema.user);

    const onlyOwnerEmail = "only-owner@example.com";
    await insertOwner(onlyOwnerEmail);

    const result = await removeOwner(onlyOwnerEmail, "someone-else@example.com");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toMatch(/last owner/i);

    const rows = await db.select().from(schema.user).where(eq(schema.user.email, onlyOwnerEmail));
    expect(rows).toHaveLength(1);
  });

  it("refuses to let an owner remove themselves, even when other owners exist", async () => {
    const db = await getDb();
    await db.delete(schema.user);

    const selfEmail = "self-remove@example.com";
    await insertOwner(selfEmail);
    await insertOwner("other-owner@example.com");

    const result = await removeOwner(selfEmail, selfEmail);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toMatch(/own account/i);

    const rows = await db.select().from(schema.user).where(eq(schema.user.email, selfEmail));
    expect(rows).toHaveLength(1);
  });

  it("errors on an email with no owner account", async () => {
    const db = await getDb();
    await db.delete(schema.user);
    await insertOwner("existing-owner@example.com");

    const result = await removeOwner("nobody@example.com", "existing-owner@example.com");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toMatch(/no owner/i);
  });

  it("removes the target owner, and cascades to delete their session and account rows", async () => {
    const db = await getDb();
    await db.delete(schema.user);

    const actingEmail = "acting-owner@example.com";
    await insertOwner(actingEmail);
    const targetId = await insertOwner("removable-owner@example.com");

    // Give the target both a credential account and a live session, the
    // way a real signed-in owner would have — this is what the cascade has
    // to take with it.
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: targetId,
      providerId: "credential",
      userId: targetId,
      password: "scrypt$131072$deadbeef$deadbeef",
    });
    await db.insert(schema.session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: targetId,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await removeOwner("removable-owner@example.com", actingEmail);
    expect(result.ok).toBe(true);

    const remainingUser = await db.select().from(schema.user).where(eq(schema.user.id, targetId));
    expect(remainingUser).toHaveLength(0);

    const remainingAccounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, targetId));
    expect(remainingAccounts).toHaveLength(0);

    const remainingSessions = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, targetId));
    expect(remainingSessions).toHaveLength(0);

    // The acting owner is untouched.
    const actingRows = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, actingEmail));
    expect(actingRows).toHaveLength(1);
  });
});

describe("changePassword revocation (auth.api.changePassword, revokeOtherSessions)", () => {
  it("revokes every other session and rejects the old password once changed", async () => {
    const auth = await getAuth();
    const email = "change-password-owner@example.com";
    const oldPassword = "the original owner password";
    const newPassword = "a brand new owner password!";

    await auth.api.signUpEmail({ body: { name: "Owner", email, password: oldPassword } });

    // Two "devices": two independent sign-ins, two independent session
    // cookies.
    const deviceA = await auth.api.signInEmail({
      body: { email, password: oldPassword },
      asResponse: true,
    });
    const cookieA = deviceA.headers.get("set-cookie")!.split(";")[0]!;
    const deviceB = await auth.api.signInEmail({
      body: { email, password: oldPassword },
      asResponse: true,
    });
    const cookieB = deviceB.headers.get("set-cookie")!.split(";")[0]!;

    expect(
      (await auth.api.getSession({ headers: new Headers({ cookie: cookieA }) }))?.user.email,
    ).toBe(email);
    expect(
      (await auth.api.getSession({ headers: new Headers({ cookie: cookieB }) }))?.user.email,
    ).toBe(email);

    // Change the password from device A, revoking every other session —
    // `returnHeaders: true` is the same pattern `src/lib/auth.ts` uses for
    // any call that sets a cookie, since no `/api/auth/*` route is mounted
    // to apply it automatically.
    const { headers: changedHeaders, response: changed } = await auth.api.changePassword({
      headers: new Headers({ cookie: cookieA }),
      body: { currentPassword: oldPassword, newPassword, revokeOtherSessions: true },
      returnHeaders: true,
    });
    expect(changed.user.email).toBe(email);
    expect(changed.token).toBeTruthy();
    const freshCookie = changedHeaders.get("set-cookie")!.split(";")[0]!;

    // Every session that existed before the change — including the one
    // that made the change — is gone. `revokeOtherSessions` deletes *all*
    // of the user's sessions and mints a fresh one, rather than sparing the
    // caller's own.
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookieA }) })).toBeNull();
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookieB }) })).toBeNull();

    // The new session token Better Auth minted for device A works.
    expect(
      (await auth.api.getSession({ headers: new Headers({ cookie: freshCookie }) }))?.user.email,
    ).toBe(email);

    // The old password no longer works; the new one does.
    await expect(
      auth.api.signInEmail({ body: { email, password: oldPassword } }),
    ).rejects.toThrow();
    const reSignIn = await auth.api.signInEmail({ body: { email, password: newPassword } });
    expect(reSignIn.user.email).toBe(email);
  });

  it("rejects the wrong current password and changes nothing", async () => {
    const auth = await getAuth();
    const email = "change-password-wrong@example.com";
    const password = "the correct current password";

    await auth.api.signUpEmail({ body: { name: "Owner", email, password } });
    const signIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const cookie = signIn.headers.get("set-cookie")!.split(";")[0]!;

    await expect(
      auth.api.changePassword({
        headers: new Headers({ cookie }),
        body: {
          currentPassword: "definitely not the right password",
          newPassword: "some other new password!",
          revokeOtherSessions: true,
        },
      }),
    ).rejects.toThrow();

    // The original password still works, and the session used for the
    // failed attempt is still alive — nothing was revoked or changed.
    expect((await auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.email).toBe(
      email,
    );
    const stillWorks = await auth.api.signInEmail({ body: { email, password } });
    expect(stillWorks.user.email).toBe(email);
  });
});
