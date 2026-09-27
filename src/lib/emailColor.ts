/**
 * Gives every HTML email our own dark version, so a mail app in dark mode
 * shows black and cream with the real yellow and red instead of repainting
 * the light design in its own browns. Run over a finished email
 * (`holdColors(html)`); the builders in `src/lib/email.ts` and
 * `src/lib/siteFormEmail.ts` stay plain inline light-mode styles.
 *
 * The dark version: paper and card go black, ink text goes cream, grey text
 * goes a light warm grey, rules darken, ink borders turn cream. Yellow, red
 * and the black header keep their colour, and text sitting on them keeps
 * its colour too (ink on the yellow button stays ink).
 *
 * What each mail app does in dark mode, and how it gets the dark version:
 *
 * - Apple Mail (iPhone, Mac), Outlook for Mac and the Outlook phone apps
 *   that honour `prefers-color-scheme` read the rules in that media query.
 *   `color-scheme: light dark` tells them the email has its own dark look.
 * - Outlook.com, the new Outlook and Outlook for Windows rewrite colours
 *   themselves and tag what they rewrote with `data-ogsb` / `data-ogsc`; the
 *   same rules under `[data-og*]` replace their rewrite with ours.
 * - An app that ignores both and repaints anyway starts from a light email,
 *   so the light-mode colours still go out as `bgcolor` attributes (read by
 *   Outlook for Windows' Word engine) and inline styles.
 * - Pieces with no text on them (the checkerboard) paint their colour as a
 *   one-colour gradient via `solidFill()`: apps that repaint backgrounds
 *   leave `background-image` alone, so the cream squares stay cream.
 *
 * Every colour this touches must be a six-digit hex in a `style` attribute
 * (`color:#1a1612`, `background:#fff8e7`). Visitor text is escaped before it
 * reaches the HTML, so a `style="` in the markup is always the template's.
 */

const STYLE_TAG = /<([a-z][a-z0-9]*)\b([^>]*?)\sstyle="([^"]*)"([^>]*)>/gi;
const TEXT_COLOR = /(?:^|;)\s*color:\s*#([0-9a-f]{6})\b/i;
const BG_COLOR = /(?:^|;)\s*background(?:-color)?:\s*#([0-9a-f]{6})\b/i;
const BORDER_COLOR = /(?:^|;)\s*border(?:-[a-z]+)?:[^;]*#([0-9a-f]{6})\b/gi;
const BGCOLOR_TAGS = new Set(["body", "table", "td", "th", "tr"]);

const INK = "1a1612";
const CREAM_TEXT = "fff8e7";

/** Dark-mode background for each light one. Colours not listed (black,
 * yellow, red) keep theirs. */
const DARK_BG: Record<string, string> = {
  fff8e7: "0f0d0b", // paper: the page and the message box
  fffdf6: INK, // card
  fff2c9: "2a241d", // cream header on the order emails
};

/** Dark-mode text colour for each light one. */
const DARK_TEXT: Record<string, string> = {
  [INK]: CREAM_TEXT,
  "6f6857": "b3a98f", // muted grey
};

/** Dark-mode border colour for each light one. */
const DARK_BORDER: Record<string, string> = {
  [INK]: CREAM_TEXT,
  e3d8bc: "3a3229", // rules
  e09e0e: "e09e0e",
};

/** `background-color` plus the same colour as a flat gradient, for a cell
 * with no text in it: the phone apps that recolour backgrounds leave
 * `background-image` alone. */
export function solidFill(hex: string): string {
  return `background-color:${hex};background-image:linear-gradient(${hex},${hex})`;
}

type Seen = {
  text: Set<string>;
  bg: Set<string>;
  border: Set<string>;
  /** "bg fg" pairs on one element whose background keeps its colour. */
  keptPairs: Set<string>;
};

function darkRules(seen: Seen, scope: (cls: string, kind: "c" | "b") => string): string {
  const rules: string[] = [];
  // Every background gets a rule, including the ones that keep their colour:
  // Outlook would otherwise darken the yellow button on its own.
  for (const c of seen.bg) {
    rules.push(`${scope(`cb-${c}`, "b")}{background-color:#${DARK_BG[c] ?? c}!important}`);
  }
  for (const c of seen.text) {
    rules.push(`${scope(`cf-${c}`, "c")}{color:#${DARK_TEXT[c] ?? c}!important}`);
  }
  for (const c of seen.border) {
    const dark = DARK_BORDER[c];
    if (dark) rules.push(`${scope(`cr-${c}`, "b")}{border-color:#${dark}!important}`);
  }
  // Text on a background that stays put keeps its own colour.
  for (const pair of seen.keptPairs) {
    const [bg, fg] = pair.split(" ");
    rules.push(`${scope(`cb-${bg}.cf-${fg}`, "c")}{color:#${fg}!important}`);
  }
  return rules.join("");
}

function head(seen: Seen): string {
  const media = darkRules(seen, (cls) => `.${cls}`);
  const outlook = darkRules(seen, (cls, kind) => {
    const attr = kind === "c" ? "data-ogsc" : "data-ogsb";
    return `[${attr}] .${cls},.${cls}[${attr}]`;
  });
  return `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme:dark){${media}}
${outlook}</style>`;
}

export function holdColors(html: string): string {
  const seen: Seen = { text: new Set(), bg: new Set(), border: new Set(), keptPairs: new Set() };

  const body = html.replace(
    STYLE_TAG,
    (tag, name: string, before: string, style: string, after: string) => {
      const fg = TEXT_COLOR.exec(style)?.[1]?.toLowerCase();
      const bg = BG_COLOR.exec(style)?.[1]?.toLowerCase();
      const borders = [...style.matchAll(BORDER_COLOR)]
        .map((m) => m[1]!.toLowerCase())
        .filter((c) => DARK_BORDER[c]);
      // One border class per element: ink wins, so a box with a thick ink
      // edge and thin rules reads as a cream-edged box.
      const border = borders.includes(INK) ? INK : borders[0];
      if (!fg && !bg && !border) return tag;

      const classes: string[] = [];
      if (fg) {
        seen.text.add(fg);
        classes.push(`cf-${fg}`);
      }
      if (bg) {
        seen.bg.add(bg);
        classes.push(`cb-${bg}`);
        if (fg && !DARK_BG[bg]) seen.keptPairs.add(`${bg} ${fg}`);
      }
      if (border) {
        seen.border.add(border);
        classes.push(`cr-${border}`);
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

  return body.replace("</head>", `${head(seen)}</head>`);
}
