#!/usr/bin/env bash
# Drops the OpenType features the site never uses from two of the
# self-hosted fonts, keeping every character they had.
#
#  - JetBrains Mono: most of the file is programming ligatures (`calt`, `ss*`,
#    `zero`...) that turn `->` or `!=` into single glyphs. The site sets short
#    labels, prices and times in it, never code. 31.4 KB -> 15.0 KB.
#  - Inter: keeps `calt` (contextual punctuation and arrows) and the numeric
#    features, drops the stylistic sets and alternates. 37.0 KB -> 32.8 KB.
#
# Every font is preloaded on every page and downloads alongside the page's
# main photo on a slow phone connection, so these bytes delay that photo.
# Measured on a throttled iPhone: home, menu, locations and careers paint
# about 0.1 s sooner. Pages render pixel-identical before and after.
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

slim src/fonts/jetbrains-mono-latin.woff2 "kern,liga,tnum,case,ccmp,mark,mkmk,locl"
slim src/fonts/inter-latin-400-800.woff2 "kern,liga,calt,tnum,case,ccmp,mark,mkmk,locl"
