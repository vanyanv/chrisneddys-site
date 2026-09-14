# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
