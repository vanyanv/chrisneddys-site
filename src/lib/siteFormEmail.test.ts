import { describe, expect, it, vi } from "vitest";
import { contactEmail, laStamp, openingListEmail, openingReplyEmail } from "@/lib/siteFormEmail";
import { locations } from "@/data/locations";

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
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe("the store art", () => {
  it("shows a monster in the topic's colour, hosted on the site", () => {
    expect(contactEmail(base, AT).html).toContain(
      'src="https://www.chrisneddys.com/email/monster-yellow.png"',
    );
    expect(contactEmail({ ...base, topic: "Order issue" }, AT).html).toContain("monster-red.png");
    expect(
      openingListEmail({ email: "delivered@resend.dev", hood: "Van Nuys" }, AT).html,
    ).toContain("monster-blue.png");
  });

  it("draws the checkerboard floor as table cells, so it shows with images off", () => {
    const { html } = contactEmail(base, AT);
    expect(html).toContain("table-layout:fixed");
    // Two strips (under the header, at the foot), two rows of 26 squares each.
    expect(html.match(/"height:9px;/g)?.length).toBe(26 * 2 * 2);
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

describe("openingReplyEmail", () => {
  const find = (id: string) => locations.find((l) => l.id === id)!;

  it("gives Van Nuys its date, address and hours before it opens", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-24T12:00:00-07:00"));
    const { subject, text, html } = openingReplyEmail(find("vannuys"));
    vi.useRealTimers();
    expect(subject).toBe("Chris N Eddy's Van Nuys: grand opening Friday, Sept 25 at 6 PM");
    expect(text.split("\n")[0]).toBe("Van Nuys opens Friday, Sept 25 at 6 PM.");
    expect(text).toContain("Where: 14523 Sherman Way, Van Nuys, CA 91405");
    expect(text).toContain("Mon–Thu  10:00 AM – 1:00 AM");
    expect(html).toContain("GET DIRECTIONS");
    expect(html).toContain("monster-blue.png");
    expect(html).toContain("not a newsletter");
  });

  it("never invents a date for a store that has none", () => {
    const { subject, text, html } = openingReplyEmail(find("glendale"));
    expect(subject).toBe("Chris N Eddy's Glendale: you're on the list");
    expect(text).toContain("Date to be announced");
    expect(text).not.toContain("Hours:");
    expect(html).not.toContain("Sept");
  });
});
