/**
 * Proves `middleware` lets a signed-out visitor reach the two new
 * password-recovery pages (`/admin/forgot-password`, `/admin/reset-password`)
 * exactly like `/admin/sign-in`, while every other `/admin/*` path still
 * redirects without a session cookie present. The real session cookie
 * (rather than a made-up name/value) comes from an actual Better Auth
 * sign-in, the same technique `betterAuth.spike.test.ts`'s A5 uses.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getAuth } from "@/lib/betterAuth";
import { middleware } from "./middleware";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

let sessionCookiePair: string;

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });

  const auth = await getAuth();
  const email = "middleware-owner@example.com";
  const password = "a real signed-in password!!";
  await auth.api.signUpEmail({ body: { name: "Middleware Owner", email, password } });
  const signInResponse = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  sessionCookiePair = signInResponse.headers.get("set-cookie")!.split(";")[0]!;
});

function requestFor(pathname: string, opts: { withSession?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.withSession) headers.cookie = sessionCookiePair;
  return new NextRequest(new URL(pathname, "http://localhost"), { headers });
}

describe("middleware", () => {
  const GUEST_PATHS = ["/admin/sign-in", "/admin/forgot-password", "/admin/reset-password"];

  it.each(GUEST_PATHS)("lets a signed-out visitor reach %s", async (pathname) => {
    const response = await middleware(requestFor(pathname));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/admin", "/admin/products", "/admin/orders", "/admin/settings"])(
    "still redirects a signed-out visitor away from %s",
    async (pathname) => {
      const response = await middleware(requestFor(pathname));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/admin/sign-in");
    },
  );

  it("lets a signed-in owner reach a protected admin path", async () => {
    const response = await middleware(requestFor("/admin/products", { withSession: true }));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("every matched response is marked private, no-store", async () => {
    for (const pathname of [...GUEST_PATHS, "/admin/products"]) {
      const response = await middleware(requestFor(pathname, { withSession: true }));
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });
});
