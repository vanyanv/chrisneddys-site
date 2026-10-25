/** Pure helpers for the crew closing page: language, wording and formatting. */

export type Lang = "en" | "es";

export const LANG_COOKIE = "cne_close_lang";
export const CREW_COOKIE = "cne_close_crew";
/** Set when Send finds the phone no longer signed in; the code screen explains it once. */
export const SIGNED_OUT_COOKIE = "cne_close_signedout";

export function parseLang(value: string | undefined): Lang {
  return value === "es" ? "es" : "en";
}

/** Picks the English or Spanish wording. */
export const pick = (lang: Lang, en: string, es: string) => (lang === "es" ? es : en);

const SECTIONS_ES: Record<string, string> = {
  Kitchen: "Cocina",
  "Front and restrooms": "Frente y baños",
  "Lock-up": "Cerrar el local",
};

/** Section names are free text; only the three starter names are translated. */
export function sectionLabel(section: string, lang: Lang): string {
  return lang === "es" ? (SECTIONS_ES[section] ?? section) : section;
}

/** A typed temperature as a plain decimal string ("38,5" becomes "38.5"), else null. */
export function normalizeTemp(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number.isFinite(Number(s)) ? s : null;
}

/** A finite number typed into a temperature box, else null. */
export function parseTemp(raw: string | undefined): number | null {
  const s = normalizeTemp(raw);
  return s === null ? null : Number(s);
}

export function tempOver(raw: string | undefined, max: number | null): boolean {
  const n = parseTemp(raw);
  return n !== null && max !== null && n > max;
}

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "1:00 AM" in Los Angeles. */
export function formatTimeLA(at: Date): string {
  return TIME.format(at).replace(/ /g, " ");
}

const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MON_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "Tue Oct 6 night" / "noche del martes 6 oct" from a `YYYY-MM-DD` business date. */
export function nightLabel(date: string, lang: Lang): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const x = new Date(Date.UTC(y, m - 1, d));
  return lang === "es"
    ? `noche del ${DAYS_ES[x.getUTCDay()]} ${d} ${MON_ES[m - 1]}`
    : `${DAYS_EN[x.getUTCDay()]} ${MON_EN[m - 1]} ${d} night`;
}

/** "1h 05m 09s" / "5m 09s" for a countdown; "12m" style via `withSeconds: false`. */
export function formatDuration(ms: number, withSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (!withSeconds) return h ? `${h}h ${m}m` : `${m}m`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;
}
