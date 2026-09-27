import { describe, expect, it } from "vitest";
import { holdColors, solidFill } from "@/lib/emailColor";

const doc = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff8e7">${body}</body></html>`;

describe("holdColors", () => {
  it("opts the email out of dark mode", () => {
    const html = holdColors(doc(""));
    expect(html).toContain('<meta name="color-scheme" content="light only">');
    expect(html).toContain('<meta name="supported-color-schemes" content="light only">');
    expect(html).toContain(":root{color-scheme:light only");
  });

  it("tags coloured elements and writes Outlook's restore rules for them", () => {
    const html = holdColors(
      doc(
        `<td style="background:#1a1612;padding:4px"><span style="font-size:1px;color:#FFF8E7">x</span></td>`,
      ),
    );
    expect(html).toContain(
      '<td class="cb-1a1612" bgcolor="#1a1612" style="background:#1a1612;padding:4px">',
    );
    expect(html).toContain('<span class="cf-fff8e7" style="font-size:1px;color:#FFF8E7">');
    expect(html).toContain("[data-ogsc] .cf-fff8e7,.cf-fff8e7[data-ogsc]{color:#fff8e7!important}");
    expect(html).toContain(
      "[data-ogsb] .cb-1a1612,.cb-1a1612[data-ogsb]{background-color:#1a1612!important}",
    );
    expect(html).toContain("@media (prefers-color-scheme:dark){");
  });

  it("adds bgcolor only where Outlook's Word engine reads it", () => {
    const html = holdColors(
      doc(`<a href="#" style="display:block;background:#f5b82e;color:#1a1612">Go</a>`),
    );
    expect(html).toContain('<a href="#" class="cf-1a1612 cb-f5b82e" style=');
    expect(html).not.toMatch(/<a [^>]*bgcolor/);
    expect(html).toContain('<body class="cb-fff8e7" bgcolor="#fff8e7"');
  });

  it("reads colour, not border-color or other properties that end in color", () => {
    const html = holdColors(doc(`<div style="border-color:#123456">x</div>`));
    expect(html).toContain('<div style="border-color:#123456">');
  });

  it("keeps a class that was already there", () => {
    expect(holdColors(doc(`<p class="a" style="color:#6f6857">x</p>`))).toContain(
      '<p class="a cf-6f6857" style="color:#6f6857">',
    );
  });
});

describe("solidFill", () => {
  it("paints the colour as a background image too", () => {
    expect(solidFill("#fff2c9")).toBe(
      "background-color:#fff2c9;background-image:linear-gradient(#fff2c9,#fff2c9)",
    );
  });
});
