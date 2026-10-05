#!/usr/bin/env bash
# Drops the OpenType features and hinting the site never uses from the
# self-hosted Barlow files, keeping every character they had.
#
#  - Barlow and Barlow Semi Condensed: the latin files Google Fonts serves,
#    minus TrueType hinting and the fraction/numerator features. About
#    22.5 KB -> 14.2 KB per weight, so the four files fit the 125 KB per-page
#    font budget (scripts/perf-budget.json) next to Bowlby One and the
#    Permanent Marker subset.
#
# Every font is preloaded on every page and downloads alongside the page's
# main photo on a slow phone connection, so these bytes delay that photo.
# When this was first done for the old Inter and JetBrains Mono files, home,
# menu, locations and careers painted about 0.1 s sooner on a throttled
# iPhone. Pages render pixel-identical before and after.
#
# Do NOT narrow `--unicodes`: an earlier try that kept only ASCII + Latin-1
# dropped the `›` on the menu's arrow buttons.
#
# Needs fontTools with brotli (`python3 -m pip install fonttools brotli`).
# Runs in place; re-running on an already slimmed file changes nothing.
set -euo pipefail
cd "$(dirname "$0")/.."

slim() {
  local file="$1" features="$2"
  local tmp
  tmp=$(mktemp --suffix=.woff2)
  python3 -m fontTools.subset "$file" \
    --output-file="$tmp" \
    --flavor=woff2 \
    --unicodes='*' \
    --layout-features="$features" \
    --no-hinting \
    --desubroutinize \
    --name-IDs='*' \
    --drop-tables+=DSIG
  mv "$tmp" "$file"
  echo "Wrote $file ($(stat -c%s "$file" 2>/dev/null || stat -f%z "$file") bytes)"
}

for f in src/fonts/barlow-latin-{400,700}.woff2 src/fonts/barlow-semi-condensed-latin-{500,700}.woff2; do
  slim "$f" "kern,liga,calt,tnum,case,ccmp,mark,mkmk,locl"
done
