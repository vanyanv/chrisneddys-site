/**
 * Where every catering button on the site goes.
 *
 * Catering is arranged with the owners directly (owner, 2026-09-27: the
 * business does not use ezCater), so the buttons open the contact form, whose
 * first and default topic is "Catering & events" — the message arrives
 * labelled without the sender picking anything.
 *
 * Every catering button also carries `data-catering`, which is how
 * `TrackEvents` tells a catering click from any other link to /contact/.
 */
export const CATERING_HREF = "/contact/";
