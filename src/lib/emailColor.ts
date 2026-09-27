/**
 * Keeps the brand colours in an HTML email when the reader's mail app is in
 * dark mode. Run over a finished email (`holdColors(html)`); the builders in
 * `src/lib/email.ts` and `src/lib/siteFormEmail.ts` stay plain inline styles.
 *
 * What each mail app does in dark mode, and what this does about it:
 *
 * - Apple Mail (iPhone, Mac) leaves an email alone when it paints its own
 *   backgrounds. The `color-scheme: light only` meta makes that explicit.
 * - Outlook.com, the new Outlook and Outlook for Windows rewrite light
 *   backgrounds dark and dark text light, and tag what they rewrote with
 *   `data-ogsb` / `data-ogsc`. The `[data-og*]` rules below put the
 *   original colours back over those rewrites.
 * - Clients that honour `prefers-color-scheme` but still adjust colours get
 *   the same restoring rules inside that media query.
 * - Outlook for Windows' Word engine reads `bgcolor` attributes, so every
 *   table and cell with a background also gets one.
 * - The Outlook and Gmail phone apps recolour whatever they like and can't be
 *   told not to. They leave images and `background-image` alone, so pieces
 *   with no text on them (the checkerboard) paint their colour as a
 *   one-colour gradient via `solidFill()` and keep it there too.
 *
 * Every colour this touches must be a six-digit hex in a `style` attribute
 * (`color:#1a1612`, `background:#fff8e7`). Visitor text is escaped before it
 * reaches the HTML, so a `style="` in the markup is always the template's.
 */

const STYLE_TAG = /<([a-z][a-z0-9]*)\b([^>]*?)\sstyle="([^"]*)"([^>]*)>/gi;
const TEXT_COLOR = /(?:^|;)\s*color:\s*#([0-9a-f]{6})\b/i;
const BG_COLOR = /(?:^|;)\s*background(?:-color)?:\s*#([0-9a-f]{6})\b/i;
const BGCOLOR_TAGS = new Set(["body", "table", "td", "th", "tr"]);

/** `background-color` plus the same colour as a flat gradient, for a cell
 * with no text in it: the phone apps that recolour backgrounds leave
 * `background-image` alone. */
export function solidFill(hex: string): string {
  return `background-color:${hex};background-image:linear-gradient(${hex},${hex})`;
}

function head(textColors: Set<string>, bgColors: Set<string>): string {
  const restore = (prefix: (cls: string) => string) =>
    [
      ...[...textColors].map((c) => `${prefix(`cf-${c}`)}{color:#${c}!important}`),
      ...[...bgColors].map((c) => `${prefix(`cb-${c}`)}{background-color:#${c}!important}`),
    ].join("");
  const outlookText = [...textColors]
    .map((c) => `[data-ogsc] .cf-${c},.cf-${c}[data-ogsc]{color:#${c}!important}`)
    .join("");
  const outlookBg = [...bgColors]
    .map((c) => `[data-ogsb] .cb-${c},.cb-${c}[data-ogsb]{background-color:#${c}!important}`)
    .join("");
  return `<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>:root{color-scheme:light only;supported-color-schemes:light only}
@media (prefers-color-scheme:dark){${restore((cls) => `.${cls}`)}}
${outlookText}${outlookBg}</style>`;
}

export function holdColors(html: string): string {
  const textColors = new Set<string>();
  const bgColors = new Set<string>();

  const body = html.replace(
    STYLE_TAG,
    (tag, name: string, before: string, style: string, after: string) => {
      const fg = TEXT_COLOR.exec(style)?.[1]?.toLowerCase();
      const bg = BG_COLOR.exec(style)?.[1]?.toLowerCase();
      if (!fg && !bg) return tag;
      const classes: string[] = [];
      if (fg) {
        textColors.add(fg);
        classes.push(`cf-${fg}`);
      }
      if (bg) {
        bgColors.add(bg);
        classes.push(`cb-${bg}`);
      }
      let attrs = `${before}${after}`;
      const existing = /\sclass="([^"]*)"/.exec(attrs);
      attrs = existing
        ? attrs.replace(existing[0], ` class="${existing[1]} ${classes.join(" ")}"`)
        : `${attrs} class="${classes.join(" ")}"`;
      if (bg && BGCOLOR_TAGS.has(name.toLowerCase()) && !/\sbgcolor=/i.test(attrs)) {
        attrs += ` bgcolor="#${bg}"`;
      }
      return `<${name}${attrs} style="${style}">`;
    },
  );

  return body.replace("</head>", `${head(textColors, bgColors)}</head>`);
}
