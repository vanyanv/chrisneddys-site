/**
 * Proves `resetPasswordAction` completes a real reset (new password
 * actually signs in afterwards) and never 500s on a bad token — missing,
 * malformed/never-issued, or already consumed by a prior successful reset.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { resetPasswordAction } from "./actions";

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

function formDataFor(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

/** Requests a real reset token for `email` the same way the forgot-password
 * page does, but captures it directly from the `sendResetPassword` hook
 * instead of parsing it out of an email — same technique as A2 in
 * `betterAuth.spike.test.ts`. */
async function issueResetToken(email: string): Promise<string> {
  const auth = await getAuth();
  const captured: { token: string | null } = { token: null };
  const original = console.log;
  // `sendResetPassword` is wired to `src/lib/email.ts`, which just logs and
  // returns `{ sent: false }` with no RESEND_API_KEY configured in tests —
  // it never throws, so `requestPasswordReset` still completes and stores
  // the verification row we need. The token itself isn't returned to the
  // caller, so it's read back from the `verification` table instead.
  console.log = () => {};
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/admin/reset-password" } });
  } finally {
    console.log = original;
  }

  const db = await getDb();
  const [row] = await db.query.verification.findMany({
    orderBy: (t, { desc }) => desc(t.createdAt),
    limit: 1,
  });
  if (!row) throw new Error("expected a verification row after requestPasswordReset");
  const token = row.identifier.replace(/^reset-password:/, "");
  captured.token = token;
  return captured.token;
}

describe("resetPasswordAction", () => {
  it("completes a reset and the new password actually works afterwards", async () => {
    const auth = await getAuth();
    const email = "reset-me@example.com";
    await auth.api.signUpEmail({
      body: { name: "Reset Me", email, password: "the original password!!" },
    });

    const token = await issueResetToken(email);
    const newPassword = "a brand new working password!";

    await expect(
      resetPasswordAction(
        undefined,
        formDataFor({ token, password: newPassword, confirmPassword: newPassword }),
      ),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });

    // Old password refused, new one signs in.
    await expect(
      auth.api.signInEmail({ body: { email, password: "the original password!!" } }),
    ).rejects.toThrow();
    const signedIn = await auth.api.signInEmail({ body: { email, password: newPassword } });
    expect(signedIn.user.email).toBe(email);
  });

  it("a missing token is handled cleanly with no database call", async () => {
    const result = await resetPasswordAction(
      undefined,
      formDataFor({
        password: "whatever password used",
        confirmPassword: "whatever password used",
      }),
    );
    expect(result).toEqual({
      expired: true,
      error: "This reset link is missing its token, so it can't be used.",
    });
  });

  it("a token that was never issued is reported as expired/used, never a stack trace", async () => {
    const result = await resetPasswordAction(
      undefined,
      formDataFor({
        token: "not-a-real-token-at-all",
        password: "a fine password here!!",
        confirmPassword: "a fine password here!!",
      }),
    );
    expect(result).toEqual({
      expired: true,
      error: "This reset link has expired or already been used.",
    });
  });

  it("a token already consumed by a prior reset is refused the second time", async () => {
    const auth = await getAuth();
    const email = "reset-twice@example.com";
    await auth.api.signUpEmail({
      body: { name: "Reset Twice", email, password: "first original password!!" },
    });

    const token = await issueResetToken(email);
    const firstPassword = "first new password here!!";

    await expect(
      resetPasswordAction(
        undefined,
        formDataFor({ token, password: firstPassword, confirmPassword: firstPassword }),
      ),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });

    const secondResult = await resetPasswordAction(
      undefined,
      formDataFor({
        token,
        password: "second new password here!!",
        confirmPassword: "second new password here!!",
      }),
    );
    expect(secondResult).toEqual({
      expired: true,
      error: "This reset link has expired or already been used.",
    });
  });

  it("rejects a password shorter than 12 characters before ever calling Better Auth", async () => {
    const result = await resetPasswordAction(
      undefined,
      formDataFor({ token: "irrelevant-token", password: "short1", confirmPassword: "short1" }),
    );
    expect(result).toEqual({ error: "Password must be at least 12 characters." });
  });

  it("rejects mismatched password/confirmation", async () => {
    const result = await resetPasswordAction(
      undefined,
      formDataFor({
        token: "irrelevant-token",
        password: "a fine password here!!",
        confirmPassword: "a different password!!",
      }),
    );
    expect(result).toEqual({ error: "Passwords don't match." });
  });
});
