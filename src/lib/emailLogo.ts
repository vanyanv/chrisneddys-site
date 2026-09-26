/**
 * The wordmark at the top left of every HTML email (the order emails in
 * `src/lib/email.ts` and the form emails in `src/lib/siteFormEmail.ts`).
 *
 * A hosted PNG, because email clients don't draw SVG or webfonts. It lives
 * at its own path under `public/email/` rather than pointing at the site
 * header's file, so renaming the site logo (public images are cached, so a
 * swap means a new name) never breaks the image in mail already sent. The
 * file is the site logo as-is: yellow letters inside a red outline on a
 * transparent background, which reads on the black and the cream header
 * bars alike and survives dark-mode clients that dim or darken the
 * background. `alt` carries the name for clients that block images.
 */
import { brand } from "@/data/brand";

export const EMAIL_LOGO_WIDTH = 150;
/** 618x174 source, so 150 wide rounds to 42 tall. */
export const EMAIL_LOGO_HEIGHT = 42;

export function emailLogoImg(altColor: string): string {
  return `<img src="${brand.siteUrl}/email/logo.png" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="${brand.name.replace(/'/g, "&#39;")}" style="display:block;width:${EMAIL_LOGO_WIDTH}px;height:${EMAIL_LOGO_HEIGHT}px;border:0;font-family:'Arial Black',Impact,sans-serif;font-size:16px;color:${altColor}">`;
}
