#!/usr/bin/env bash
# Regenerates src/fonts/permanent-marker-subset.woff2 — see issue #87.
#
# `.cne-eyebrow` (chrome-art.css overrides counter.css's uppercase transform
# to `none`), the footer's `.cne-tag-word`/`.cne-foot-tag-ink`, and
# `.cne-sleep-z` are the only things set in Permanent Marker, and none of
# them is forced to a single case. Their text comes from hardcoded JSX
# strings plus a few data files an owner can edit (src/data/menu.ts item
# names, src/data/merch.ts product eyebrows, src/data/locations.ts
# neighbourhoods) — mixed case, digits, parens, hyphens, apostrophes.
#
# Per DESIGN.md-adjacent guidance for issue #87: since the rendered text is
# NOT all-uppercase, the glyph set is Basic Latin printable (U+0020-007E)
# plus the curly quotes / dashes / middle dot actually seen in the copy
# (’, —, ·) with their pairs included for symmetry (‘, –, “, ”). The ★ used
# in one eyebrow ("★ The three we sell most") is NOT in Permanent Marker's
# own glyph set either (confirmed via the font's unicode-range, which tops
# out at U+206F) — it already renders from the fallback font today, so
# leaving it out of the subset changes nothing.
#
# Source: the exact file next/font/google fetched for this project, found
# in .next/static/media/<hash>-s.p.woff2 (matched via the `Permanent Marker`
# @font-face block in .next/static/css/*.css). Re-run `pnpm build` once to
# regenerate that cache if it's missing, then update SRC below.

set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-}"
if [ -z "$SRC" ]; then
  SRC=$(grep -l "Permanent Marker" .next/static/css/*.css 2>/dev/null | head -1 | xargs -I{} grep -o '/_next/static/media/[a-f0-9]*-s\.p\.woff2' {} | head -1 | sed 's#^/_next#.next#')
fi
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "Could not find the Permanent Marker source woff2 in .next/. Run 'pnpm build' first, or pass its path as \$1." >&2
  exit 1
fi

OUT="src/fonts/permanent-marker-subset.woff2"
UNICODES="U+0020-007E,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+00B7"

python3 -m fontTools.subset \
  "$SRC" \
  --output-file="$OUT" \
  --flavor=woff2 \
  --unicodes="$UNICODES" \
  --layout-features='*' \
  --no-hinting \
  --desubroutinize \
  --name-IDs='' \
  --drop-tables+=DSIG

echo "Wrote $OUT ($(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT") bytes) from $SRC"
