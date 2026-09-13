# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Performance: the site's CSS is inlined into each exported page instead of loaded as two render-blocking stylesheets, roughly halving first paint on throttled mobile across all routes ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Performance: web fonts use `font-display: optional` so text no longer reflows when Bowlby One, Inter, or JetBrains Mono finish loading; on a slow first visit the metric-matched fallback is kept for that page view ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Performance: the About page's two Way buttons are now visible in the initial HTML instead of fading in after script runs, cutting that page's Largest Contentful Paint by about 0.7 s on throttled mobile ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Performance: Plausible analytics now loads after the window load event instead of right after hydration, keeping it off the critical path on every page ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))

### Fixed

- Privacy page: paragraphs no longer jump when the body font finishes loading (layout shift 0.109 to 0) ([#19](https://github.com/vanyanv/chrisneddys-site/issues/19))
- Product page: the mobile sticky ADD TO BAG bar now stays pinned for the whole page instead of scrolling away after the buy column ([#17](https://github.com/vanyanv/chrisneddys-site/issues/17))

## [0.2.0] - 2026-09-13

### Changed

- Shop: the Foam Trucker — Blue (Capsule 01, limited to 50) replaces the placeholder Ball-Cap, with an eight-view gallery and certificate of authenticity ([#14](https://github.com/vanyanv/chrisneddys-site/issues/14))

### Fixed

- Mobile header: bag button no longer overlaps the wordmark when the bag has items ([#11](https://github.com/vanyanv/chrisneddys-site/issues/11))

## [0.1.0] - 2026-09-12

Initial tracked version.
