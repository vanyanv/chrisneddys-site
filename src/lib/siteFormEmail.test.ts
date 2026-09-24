import { describe, expect, it } from "vitest";
import { contactEmail, laStamp, openingListEmail } from "@/lib/siteFormEmail";

// 18:12 UTC on a Thursday in September is 11:12 AM in Los Angeles (PDT).
const AT = new Date("2026-09-24T18:12:00Z");

const base = {
  name: "Sam Rivera",
  email: "delivered@resend.dev",
  phone: "(323) 555-0142",
  topic: "Catering & events",
  message: "Forty sliders for a birthday on the 12th?\nAround 6 PM.",
};

describe("laStamp", () => {
  it("reads the restaurant's own clock, not the server's", () => {
    expect(laStamp(AT)).toBe("Thu 9/24 · 11:12 AM");
  });
});

describe("contactEmail", () => {
  it("leads with the topic and who wrote, and keeps the subject sortable", () => {
    const { subject, text, html } = contactEmail(base, AT);
    expect(subject).toBe("[Catering & events] Sam Rivera — chrisneddys.com");
    expect(text.split("\n")[0]).toBe("CATERING & EVENTS");
    expect(text).toContain("Sam Rivera wrote in through the website, Thu 9/24 · 11:12 AM.");
    expect(html).toContain("Sam Rivera wrote in.");
    expect(html).toContain("Thu 9/24 · 11:12 AM");
  });

  it("offers a tap-to-reply and, when a phone was given, a tap-to-call", () => {
    const { html } = contactEmail(base, AT);
    expect(html).toContain("REPLY TO SAM");
    expect(html).toContain('href="tel:3235550142"');
    expect(html).toContain("CALL (323) 555-0142");
  });

  it("has no call button without a phone number", () => {
    const { html, text } = contactEmail({ ...base, phone: "" }, AT);
    expect(html).not.toContain("tel:");
    expect(html).toContain("Not given");
    expect(text).toContain("Phone: not given");
  });

  it("marks an order issue in red so it stands out", () => {
    expect(contactEmail({ ...base, topic: "Order issue" }, AT).html).toContain("#d0281c");
    expect(contactEmail(base, AT).html).not.toContain("#d0281c");
  });

  it("escapes everything the visitor typed", () => {
    const { html, subject } = contactEmail(
      { ...base, name: 'Eve <img src=x onerror="1">\r\nBcc: a@b.c', message: "<script>x</script>" },
      AT,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe("openingListEmail", () => {
  it("names the location and gives a way to write back", () => {
    const { subject, text, html } = openingListEmail(
      { email: "delivered@resend.dev", hood: "Glendale" },
      AT,
    );
    expect(subject).toBe("[Opening list — Glendale] delivered@resend.dev");
    expect(text).toContain("Someone wants to know when Glendale opens.");
    expect(html).toContain("Opening list · Glendale");
    expect(html).toContain("EMAIL THEM");
  });
});
