import { describe, expect, it } from "vitest";
import { holdColors, solidFill } from "@/lib/emailColor";

const doc = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff8e7">${body}</body></html>`;

describe("holdColors", () => {
  it("tells mail apps the email has its own dark version", () => {
    const html = holdColors(doc(""));
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<meta name="supported-color-schemes" content="light dark">');
    expect(html).toContain("@media (prefers-color-scheme:dark){");
  });

  it("turns paper black and ink text cream, for Outlook and for everyone else", () => {
    const html = holdColors(doc(`<p style="color:#1A1612">x</p>`));
    expect(html).toContain('<p class="cf-1a1612" style="color:#1A1612">');
    expect(html).toContain(".cb-fff8e7{background-color:#0f0d0b!important}");
    expect(html).toContain(".cf-1a1612{color:#fff8e7!important}");
    expect(html).toContain("[data-ogsc] .cf-1a1612,.cf-1a1612[data-ogsc]{color:#fff8e7!important}");
    expect(html).toContain(
      "[data-ogsb] .cb-fff8e7,.cb-fff8e7[data-ogsb]{background-color:#0f0d0b!important}",
    );
  });

  it("keeps the yellow button yellow with ink text", () => {
    const html = holdColors(
      doc(
        `<a href="#" style="display:block;background:#f5b82e;border:2px solid #1a1612;color:#1a1612">Go</a>`,
      ),
    );
    expect(html).toContain('<a href="#" class="cf-1a1612 cb-f5b82e cr-1a1612" style=');
    expect(html).toContain(".cb-f5b82e{background-color:#f5b82e!important}");
    expect(html).toContain(".cb-f5b82e.cf-1a1612{color:#1a1612!important}");
    expect(html).toContain(".cr-1a1612{border-color:#fff8e7!important}");
  });

  it("gives a box with an ink edge and thin rules one cream border", () => {
    const html = holdColors(
      doc(`<div style="border:1px solid #e3d8bc;border-left:4px solid #1a1612">x</div>`),
    );
    expect(html).toContain('<div class="cr-1a1612" style=');
  });

  it("adds bgcolor only where Outlook's Word engine reads it", () => {
    const html = holdColors(
      doc(`<td style="background:#1a1612"><a href="#" style="background:#f5b82e">Go</a></td>`),
    );
    expect(html).toContain('<td class="cb-1a1612" bgcolor="#1a1612" style="background:#1a1612">');
    expect(html).not.toMatch(/<a [^>]*bgcolor/);
    expect(html).toContain('<body class="cb-fff8e7" bgcolor="#fff8e7"');
  });

  it("reads colour, not other properties that end in color", () => {
    expect(holdColors(doc(`<div style="outline-color:#123456">x</div>`))).toContain(
      '<div style="outline-color:#123456">',
    );
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
