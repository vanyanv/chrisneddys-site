/**
 * The contact form and opening-list actions: what reaches Resend, what never
 * does, and the per-IP cap. Resend itself is never called — `fetch` is
 * stubbed, the same way `email.test.ts` does it, because the sandbox can't
 * reach api.resend.com and a test must not send real mail.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { brand } from "@/data/brand";
import { joinOpeningList, sendContactMessage } from "@/lib/siteForms";

vi.mock("server-only", () => ({}));
// No request to read headers from in a unit test — see `resolveClientIp`.
const ipState = vi.hoisted(() => ({ ip: "203.0.113.1" }));
vi.mock("@/lib/auth", () => ({ resolveClientIp: async () => ipState.ip }));

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

beforeEach(async () => {
  process.env.RESEND_API_KEY = "re_test_fake";
  process.env.EMAIL_FROM = "Chris N Eddy's <hello@chrisneddys.com>";
  ipState.ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
  const db = await getDb();
  await db.execute(sql`delete from sign_in_attempts where kind = 'site_form'`);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

function mockResend(status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" }), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const contact = {
  name: "Sam Rivera",
  email: "delivered@resend.dev",
  phone: "",
  topic: "Catering & events",
  message: "Forty sliders for a birthday on the 12th?",
  botcheck: "",
};

describe("sendContactMessage", () => {
  it("emails the site's own address with the visitor as reply-to", async () => {
    const fetchMock = mockResend();
    expect(await sendContactMessage(form(contact))).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(init.body);
    expect(payload.to).toBe(brand.email);
    // Its own sender on the same domain, so form mail stands apart from orders.
    expect(payload.from).toBe("Chris N Eddy's Website <website@chrisneddys.com>");
    expect(payload.reply_to).toBe("delivered@resend.dev");
    expect(payload.subject).toBe("[Catering & events] Sam Rivera — chrisneddys.com");
    expect(payload.text).toContain("Forty sliders for a birthday on the 12th?");
    expect(payload.text).toContain("Phone: not given");
    expect(payload.html).toContain("REPLY TO SAM");
    expect(payload.html).toContain(
      "mailto:delivered@resend.dev?subject=Re%3A%20Catering%20%26%20events",
    );
  });

  it("escapes what the visitor typed in the HTML body and keeps the subject on one line", async () => {
    const fetchMock = mockResend();
    await sendContactMessage(
      form({ ...contact, name: "Sam\r\nBcc: x@y.z", message: "<script>alert(1)</script>" }),
    );
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).toContain("&lt;script&gt;");
  });

  it("sends nothing and still says ok when the honeypot is filled", async () => {
    const fetchMock = mockResend();
    expect(await sendContactMessage(form({ ...contact, botcheck: "on" }))).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects what the form itself would not send", async () => {
    const fetchMock = mockResend();
    for (const bad of [
      { email: "not-an-email" },
      { name: "" },
      { message: "" },
      { message: "x".repeat(1201) },
      { topic: "Free burgers" },
    ]) {
      expect(await sendContactMessage(form({ ...contact, ...bad }))).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says not_configured, without calling Resend, when email isn't set up", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = mockResend();
    expect(await sendContactMessage(form(contact))).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says send_failed when Resend refuses the send", async () => {
    mockResend(403);
    expect(await sendContactMessage(form(contact))).toEqual({ ok: false, reason: "send_failed" });
  });

  it("caps one IP at five sends per window, across both forms", async () => {
    const fetchMock = mockResend();
    for (let i = 0; i < 4; i++) {
      expect(await sendContactMessage(form(contact))).toEqual({ ok: true });
    }
    expect(
      await joinOpeningList(form({ email: "delivered@resend.dev", location: "Glendale" })),
    ).toEqual({ ok: true });
    expect(await sendContactMessage(form(contact))).toEqual({ ok: false, reason: "throttled" });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    ipState.ip = "198.51.100.7";
    expect(await sendContactMessage(form(contact))).toEqual({ ok: true });
  });
});

describe("joinOpeningList", () => {
  it("emails the signup for a location that hasn't opened", async () => {
    const fetchMock = mockResend();
    expect(
      await joinOpeningList(form({ email: "delivered@resend.dev", location: "Van Nuys" })),
    ).toEqual({ ok: true });
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.to).toBe(brand.email);
    expect(payload.reply_to).toBe("delivered@resend.dev");
    expect(payload.subject).toBe("[Opening list — Van Nuys] delivered@resend.dev");
  });

  it("refuses a location that is already open or doesn't exist", async () => {
    const fetchMock = mockResend();
    for (const location of ["Hollywood", "Atlantis"]) {
      expect(await joinOpeningList(form({ email: "delivered@resend.dev", location }))).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
