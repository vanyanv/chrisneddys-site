#!/usr/bin/env bash
# Regenerates src/fonts/inter-latin-400-800.woff2.
#
# The storefront sets Inter at 400, 500, 600, 700 and 800 only. next/font/google
# served all five from one variable file whose weight axis runs 100-900 (48 KB
# for the latin subset), preloaded at high priority on every page, where on a
# slow phone connection it shares the line with the home page's hero photo —
# the page's Largest Contentful Paint. Pinning the axis to the 400-800 range
# the site uses drops it to ~37 KB. Every glyph, feature and weight the site
# draws is unchanged: this is the same file with the unused ends of the weight
# axis cut off, not a re-draw or a re-subset.
#
# Source: the exact latin file next/font/google fetched for this project, found
# in .next/static/media/<hash>-s.p.woff2 (matched via the `Inter` @font-face
# block in .next/static/css/*.css). If the site layout no longer loads Inter
# from Google, add `Inter` back to its next/font/google import temporarily
# (or point $1 at a latin Inter woff2 from Google Fonts) and re-run.
#
# Needs fontTools with brotli: python3 -m pip install fonttools brotli

set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-}"
if [ -z "$SRC" ]; then
  # The latin file is the one whose @font-face carries `u+00??` in its range.
  SRC=$(cat .next/static/css/*.css 2>/dev/null |
    grep -o 'font-family:Inter;[^}]*' |
    grep 'u+00??' |
    grep -o '/_next/static/media/[a-f0-9]*-s\.p\.woff2' |
    sort -u | sed 's#^/_next#.next#' || true)
fi
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "Could not find the latin Inter source woff2 in .next/. Pass its path as \$1." >&2
  exit 1
fi

OUT="src/fonts/inter-latin-400-800.woff2"

python3 - "$SRC" "$OUT" <<'PY'
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src, out = sys.argv[1], sys.argv[2]
font = instancer.instantiateVariableFont(TTFont(src), {"wght": (400, 800)})
font.flavor = "woff2"
font.save(out)
PY

echo "Wrote $OUT ($(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT") bytes) from $SRC"
