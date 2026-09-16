# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Admin: `/admin` now opens on Today — a work queue of what actually needs doing, rather than bouncing you to the products list. It shows orders waiting to be packed oldest first, flags one that has been waiting more than a day, counts numbers held in open checkouts, and surfaces anything still unconfigured in setup. Money taken today, how many are left in the run, and what just happened sit alongside it. Every row is real data or it isn't shown ([#36](https://github.com/vanyanv/chrisneddys-site/issues/36))
- Admin: sign-in is now a real account per owner, not one password shared by everyone. Each owner sets their own password and can change it from Settings; a forgotten one is reset by a link emailed to them. Settings also gets an Owners card to invite a new owner by email or remove one. Sessions now last 12 hours and can be revoked — signing out, changing a password, or removing an owner logs that device out immediately rather than leaving a 30-day token valid until it expires on its own. ([#33](https://github.com/vanyanv/chrisneddys-site/issues/33))
- Admin: the products area is now one editable sheet. Price, stock and Live/Hidden change in place, a bottom Save bar collects the sweep into one save with Undo, rows expand inline for photos, copy and edition details, rows drag to set the shop order, and a new product is an inline row. Orders and Settings share the calmer shell. ([#28](https://github.com/vanyanv/chrisneddys-site/issues/28))
- Admin: Orders and Settings adopt the same sheet system as Products. Orders gets search, status chips, two-line rows on phones and a one-surface order page; Settings gets grouped sections, a Save bar that appears only when something changed, and a Connections list. The order page shows the new status right after marking an order shipped, ready, picked up or refunded. The Chris N Eddy's logo replaces the typed wordmark in the top bar, sign-in and packing slip. ([#32](https://github.com/vanyanv/chrisneddys-site/issues/32))
- Development: `pnpm release` cuts a release — it dates the `[Unreleased]` section, bumps the version, writes the compare links and tags `vX.Y.Z`. A `commit-msg` hook refuses a commit that references an issue and changes shipped code without a `CHANGELOG.md` line, so entries stop going missing
- Development: `pnpm test:e2e` runs a Playwright suite against a production build on its own PGlite database (`PGLITE_DATA_DIR`) ([#28](https://github.com/vanyanv/chrisneddys-site/issues/28))
- Checkout Sessions now enable invoice creation, so Stripe generates an invoice for every order rather than only for subscriptions. Whether the customer is emailed it remains a per-environment Dashboard setting, which `DEPLOY.md` now spells out

### Changed

- `STRIPE_SECRET_KEY` should hold a restricted key scoped to write on Checkout Sessions and read on Tax, not a full secret key. The variable name is unchanged; only the value and the guidance around it are

### Fixed

- Admin: resetting a password from the emailed link only changed the password — anyone still signed in on another device stayed signed in, which defeats the point of resetting a password because you think someone got in. A reset now signs out every device, the same way changing your password from Settings already does ([#36](https://github.com/vanyanv/chrisneddys-site/issues/36))
- Admin: an owner who mistyped their password five times was locked out for 15 minutes — and every retry while locked counted as another failure, restarting that 15-minute window, so they could never get back in. Getting locked out no longer records a new failure, and a correct password now clears that owner's earlier mistakes ([#34](https://github.com/vanyanv/chrisneddys-site/issues/34))
- Checkout Sessions declared no product tax code and no tax behaviour, so both fell back to the Stripe account's presets. That account carries none of either, and clothing is taxed differently from the general default in several states. Line items now declare `txcd_30011000` and the shipping rate `txcd_92010001`, both tax-exclusive
- `DEPLOY.md` claimed Stripe errors at session-creation time when Tax has no registration, so checkout would break rather than under-charge. It is the other way round: an activated Stripe Tax with no registration in the buyer's jurisdiction collects zero, returns no error and looks entirely normal. Before that, with no head office address set, Tax is not active at all and a calculation is rejected outright. Both states are now written down
- Admin: the entire `/admin` interface rendered unstyled — correct typography on a blank white page. `admin.css` draws with 11 `--a-*` tokens that were defined only in `counter.css`, which the admin route group never loads, so every `background`, `border`, `box-shadow` and `color` in it was dropped as invalid at computed-value time. The tokens now live in `src/styles/tokens.css`, imported by both stylesheets
- Admin: photos seeded from the repo showed as black squares in the product editor and the products table. Those rows store a stem (`front`, `angle`) resolved against the product's `photoDir`, which the admin had no field for and no code path to use — it understood only uploaded Blob URLs. Both now resolve through one helper, the way the storefront always has
- Admin: the product slug field accepted any value. Its `pattern` was `^[a-z0-9-]+$`, which fails to compile under the `v` flag browsers apply to that attribute, so the invalid regex was discarded along with the validation
- Admin: the sidebar painted a stray horizontal scrollbar under the last nav item once it became a column at 900px and up
- Bag: a line named only the second half of the product's display name — "— BLUE" rather than "THE FOAM TRUCKER — BLUE"
- Development: `next dev` no longer serves a Content-Security-Policy that breaks itself. `upgrade-insecure-requests` rewrote the admin's own upload request to https against a port speaking no TLS, and the absence of `'unsafe-eval'` blocked react-refresh, so no client component on the site hydrated — add-to-bag, the bag drawer and the product gallery all silently did nothing. Both are now gated on `NODE_ENV`; the deployed policy is unchanged
- `pnpm install` failed before it could start: the lockfile carried two concatenated YAML documents, and `packageManager` pinned a pnpm version that does not exist

## [0.3.0] - 2026-09-14

### Changed

- Security headers and cache policy now ship from `next.config.mjs` so they apply on Vercel's server build; Vercel Blob is allowed for product images ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Shop: the catalogue now lives in Postgres (Neon) with the in-repo product as seed and fallback; the site no longer builds as a static export ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Performance: the site's CSS is inlined into each exported page instead of loaded as two render-blocking stylesheets, roughly halving first paint on throttled mobile across all routes ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Performance: web fonts use `font-display: optional` so text no longer reflows when Bowlby One, Inter, or JetBrains Mono finish loading; on a slow first visit the metric-matched fallback is kept for that page view ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Performance: the About page's two Way buttons are now visible in the initial HTML instead of fading in after script runs, cutting that page's Largest Contentful Paint by about 0.7 s on throttled mobile ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Performance: Plausible analytics now loads after the window load event instead of right after hydration, keeping it off the critical path on every page ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))

### Fixed

- Privacy page: paragraphs no longer jump when the body font finishes loading (layout shift 0.109 to 0) ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Product page: the mobile sticky ADD TO BAG bar now stays pinned for the whole page instead of scrolling away after the buy column ([#17](https://github.com/vanyanv/chrisneddys-site/issues/17))
- Cart lines now show the image of the product that was added instead of a generic cap placeholder ([#18](https://github.com/vanyanv/chrisneddys-site/issues/18))

### Added

- Shop: live "N of 50 left" count and sold-out state, shown only when the database tracks inventory ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Owner sign-in and the `/admin` shell — email allowlist + shared password, session cookie, middleware protection, and a bare dashboard ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Admin: products can be created, edited, photographed (Vercel Blob), stocked as a quantity or a numbered edition, and published from /admin/products ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Store settings in the admin (shipping, pickup, returns policy, terms), /returns and /terms pages, and a privacy policy that describes the store ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Admin orders desk: list, detail, mark shipped with tracking, pickup flow, packing slip, refund marker ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))
- Shop: checkout through Stripe's hosted page with Stripe Tax, edition numbers assigned on payment, order confirmation emails, a thanks page and an order lookup page — live once the Stripe and Resend keys are set ([#22](https://github.com/vanyanv/chrisneddys-site/issues/22))

## [0.2.0] - 2026-09-13

### Changed

- Shop: the Foam Trucker — Blue (Capsule 01, limited to 50) replaces the placeholder Ball-Cap, with an eight-view gallery and certificate of authenticity ([#14](https://github.com/vanyanv/chrisneddys-site/issues/14))

### Fixed

- Mobile header: bag button no longer overlaps the wordmark when the bag has items ([#11](https://github.com/vanyanv/chrisneddys-site/issues/11))

## [0.1.0] - 2026-09-12

Initial tracked version.
