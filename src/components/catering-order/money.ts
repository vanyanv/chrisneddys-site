/** Integer cents -> "$12.34", for every catering screen — the pure library
 * deals only in cents, so every component formats through this one place. */
export function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}
