/**
 * Whether this page should report at all.
 *
 * A real function rather than a line of string-concatenated JavaScript, because
 * it is the one piece of analytics logic whose failure mode is silent in both
 * directions — a gate that is too loose pollutes the property, one that is too
 * tight loses the launch — so it is worth being able to test. It lives in its
 * own module (rather than in Analytics.tsx, next to the component that
 * serialises it) so a test can import it without pulling in JSX — and it is
 * serialised into the inline snippet there by `toString()`, so there is
 * exactly one copy of the rule and no way for the tested version and the
 * shipped one to drift.
 *
 * `search` is taken as an argument for the same reason: nothing here touches
 * `window`, so it runs in a test as happily as in a browser.
 *
 * MUST NOT reference anything outside its own parameters — no module-scope
 * constant, no import, nothing. It is serialised into the inline script in
 * Analytics.tsx with `.toString()`, so a closed-over reference would either
 * crash the page (the name does not exist in that scope) or silently read
 * something else entirely, and either way the tested function and the shipped
 * one would no longer be the same code.
 */
export function shouldTrack(hostname: string, search: string): boolean {
  // `search` is unused today — the debug flag deliberately cannot open the
  // gate — but it stays in the signature because "is this host allowed to
  // report" and "was this a deliberate debug visit" are asked in one breath.
  void search;
  return hostname === "chrisneddys.com" || hostname.endsWith(".chrisneddys.com");
}
