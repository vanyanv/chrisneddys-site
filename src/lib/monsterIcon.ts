/**
 * The blue "classic" monster with the mural grin, as a standalone SVG string:
 * `cne-classic` from `MascotDefs.tsx` with its colours resolved, framed
 * tightly for small sizes. It's used by the share card, and it's the same art
 * as `src/app/icon.svg`, the browser-tab icon. A test keeps the two identical.
 */
export const MONSTER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 14 184 184">
<defs><clipPath id="m"><path d="M34.3,112 C71.1,121 128.9,121 165.7,112 Q172.7,113 169.7,124 A72,72 0 0 1 30.3,124 Q27.3,113 34.3,112 Z"/></clipPath></defs><circle cx="100" cy="106" r="86" fill="#2e5fd9" stroke="#14110d" stroke-width="9"/><g clip-path="url(#m)"><path d="M34.3,112 C71.1,121 128.9,121 165.7,112 Q172.7,113 169.7,124 A72,72 0 0 1 30.3,124 Q27.3,113 34.3,112 Z" fill="#14110d"/><path d="M32,106.4 C32,123.3 40.5,135.4 45,135.4 C49.5,135.4 60,123.3 60,106.4 Z" fill="#fff8e7"/><path d="M62,110.3 C62,130.6 76.6,145.3 83,145.3 C89.4,145.3 102,130.6 102,110.3 Z" fill="#fff8e7"/><path d="M99,110.3 C99,130 111.6,144.3 118,144.3 C124.4,144.3 139,130 139,110.3 Z" fill="#fff8e7"/><path d="M137,106.8 C137,123.6 149.2,135.8 154,135.8 C158.8,135.8 167,123.6 167,106.8 Z" fill="#fff8e7"/><path d="M45,175.2 C45,158.3 59.6,146.2 65,146.2 C70.4,146.2 79,158.3 79,175.2 Z" fill="#fff8e7"/><path d="M80,186 C80,168.6 92.9,156 99,156 C105.1,156 118,168.6 118,186 Z" fill="#fff8e7"/><path d="M119,176.4 C119,160.1 128.6,148.4 134,148.4 C139.4,148.4 153,160.1 153,176.4 Z" fill="#fff8e7"/></g><path d="M34.3,112 C71.1,121 128.9,121 165.7,112 Q172.7,113 169.7,124 A72,72 0 0 1 30.3,124 Q27.3,113 34.3,112 Z" fill="none" stroke="#14110d" stroke-width="7" stroke-linejoin="round"/><circle cx="100" cy="76" r="33" fill="#fff8e7"/><circle cx="100" cy="76" r="17" fill="#e63027" stroke="#14110d" stroke-width="4"/><circle cx="100" cy="76" r="7" fill="#14110d"/></svg>`;

export const MONSTER_ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(MONSTER_ICON_SVG).toString("base64")}`;
