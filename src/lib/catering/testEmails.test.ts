import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { saveCateringSettings } from "./settings";

vi.mock("server-only", () => ({}));

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendEmail: sendEmailMock };
});

import { sendCateringTestEmails, TEST_EMAIL_COOLDOWN_MS } from "./testEmails";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

let db: Db;

beforeAll(async () => {
  db = await getDb();
  await migrate(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder });
});

beforeEach(async () => {
  await db.delete(schema.signInAttempts);
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ sent: true });
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Chris N Eddy's <orders@example.com>";
  await saveCateringSettings({ ownerEmail: "chris@chrisneddys.com" }, db);
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

describe("sendCateringTestEmails", () => {
  it("sends the owner and customer emails to the owner address, subjects prefixed [TEST]", async () => {
    const result = await sendCateringTestEmails(db, "chris@chrisneddys.com", "1.2.3.4");
    expect(result.ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);

    const [ownerCall, customerCall] = sendEmailMock.mock.calls;
    expect(ownerCall![0]).toBe("chris@chrisneddys.com");
    expect(ownerCall![1]).toMatch(/^\[TEST\] /);
    expect(customerCall![0]).toBe("chris@chrisneddys.com");
    expect(customerCall![1]).toMatch(/^\[TEST\] /);
    expect(customerCall![1]).not.toBe(ownerCall![1]);
    if (result.ok) expect(result.lines.every((l) => l.sent)).toBe(true);
  });

  it("addresses both emails to the catering owner email setting", async () => {
    await saveCateringSettings({ ownerEmail: "someone-else@example.com" }, db);
    await sendCateringTestEmails(db, "chris@chrisneddys.com", "1.2.3.4");
    expect(sendEmailMock.mock.calls.map((c) => c[0])).toEqual([
      "someone-else@example.com",
      "someone-else@example.com",
    ]);
  });

  it("says email isn't set up, naming what is missing, and sends nothing", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendCateringTestEmails(db, "chris@chrisneddys.com", "1.2.3.4");
    expect(result).toEqual({
      ok: false,
      error: "Email isn't set up: missing RESEND_API_KEY.",
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("reports the Resend error for an email that failed", async () => {
    sendEmailMock.mockResolvedValueOnce({ sent: false, reason: "Resend responded 403." });
    const result = await sendCateringTestEmails(db, "chris@chrisneddys.com", "1.2.3.4");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lines[0]).toMatchObject({ sent: false, message: "Resend responded 403." });
      expect(result.lines[1]).toMatchObject({ sent: true });
    }
  });

  it("allows one send a minute", async () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect((await sendCateringTestEmails(db, "a@b.co", "1.2.3.4", now)).ok).toBe(true);
    sendEmailMock.mockClear();

    const tooSoon = new Date(now.getTime() + 10_000);
    const blocked = await sendCateringTestEmails(db, "a@b.co", "1.2.3.4", tooSoon);
    expect(blocked.ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();

    const later = new Date(now.getTime() + TEST_EMAIL_COOLDOWN_MS + 1000);
    expect((await sendCateringTestEmails(db, "a@b.co", "1.2.3.4", later)).ok).toBe(true);
  });
});
