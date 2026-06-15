#!/usr/bin/env bash
#
# add-photo.sh — turn one source image into the two webp files the portfolio
# needs, named and sized correctly:
#
#   photography/<slug>.webp        grid thumbnail   (longest edge 1200px, light)
#   photography/<slug>-full.webp   lightbox version (longest edge 2400px, sharp)
#
# It never upscales past the source, so a small original just gives smaller files.
# Keep your original PNG/JPG master somewhere safe — only the webps go in the repo.
#
# Usage:
#   ./scripts/add-photo.sh "<path to image>" [slug]
#
# Examples:
#   ./scripts/add-photo.sh "~/Desktop/scans/brau back covers.png"
#       -> photography/brau-back-covers.webp  + ...-full.webp
#   ./scripts/add-photo.sh "~/Desktop/IMG_0421.jpg" lisbon-rooftop
#       -> photography/lisbon-rooftop.webp    + ...-full.webp

set -euo pipefail

# --- locate the repo's photography/ folder relative to this script ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../photography"

# --- required tools ---
command -v cwebp >/dev/null || { echo "✗ cwebp not found. Install it with:  brew install webp"; exit 1; }
command -v sips  >/dev/null || { echo "✗ sips not found (this script needs macOS)."; exit 1; }

# --- arguments ---
SRC="${1:-}"
[ -n "$SRC" ] || { echo "Usage: $0 \"<path to image>\" [slug]"; exit 1; }
SRC="${SRC/#\~/$HOME}"                       # expand a leading ~ to the home folder
[ -f "$SRC" ] || { echo "✗ File not found: $SRC"; exit 1; }

# slug: use the 2nd argument, or build one from the filename
# (lowercase, anything that isn't a letter/number becomes a single hyphen)
if [ -n "${2:-}" ]; then
  SLUG="$2"
else
  base="$(basename "$SRC")"; base="${base%.*}"
  SLUG="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')"
fi
[ -n "$SLUG" ] || { echo "✗ Could not build a name from the filename — pass one as the 2nd argument."; exit 1; }

# --- read the source size, pick the longest edge so portrait & landscape both work ---
W=$(sips -g pixelWidth  "$SRC" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$SRC" | awk '/pixelHeight/{print $2}')
if [ "$W" -ge "$H" ]; then ORIENT="w"; LONG=$W; else ORIENT="h"; LONG=$H; fi

# target longest edge, clamped so we never enlarge past the original
grid_long=1200; [ "$LONG" -lt "$grid_long" ] && grid_long=$LONG
full_long=2400; [ "$LONG" -lt "$full_long" ] && full_long=$LONG

# turn a longest-edge number into cwebp's "width height" resize pair (0 = keep ratio)
resize_pair() { [ "$ORIENT" = "w" ] && echo "$1 0" || echo "0 $1"; }

mkdir -p "$OUT_DIR"
GRID="$OUT_DIR/$SLUG.webp"
FULL="$OUT_DIR/$SLUG-full.webp"

cwebp -q 80 -m 6 -resize $(resize_pair "$grid_long") "$SRC" -o "$GRID" >/dev/null 2>&1
cwebp -q 90 -m 6 -resize $(resize_pair "$full_long") "$SRC" -o "$FULL" >/dev/null 2>&1

# --- report + a ready-to-paste <img> line ---
gw=$(sips -g pixelWidth  "$GRID" | awk '/pixelWidth/{print $2}')
gh=$(sips -g pixelHeight "$GRID" | awk '/pixelHeight/{print $2}')

echo "✓ grid : $GRID  (${gw}×${gh}, $(du -h "$GRID" | cut -f1))"
echo "✓ full : $FULL  ($(du -h "$FULL" | cut -f1))"
echo
echo "Paste this into the .photo-grid in index.html (edit the alt text):"
echo "  <img class=\"photo\" src=\"/photography/$SLUG.webp\" data-full=\"/photography/$SLUG-full.webp\" alt=\"DESCRIBE THIS PHOTO\" width=\"$gw\" height=\"$gh\" loading=\"lazy\">"
[ "$ORIENT" = "w" ] && echo "  (wide shot? add  photo-wide  to the class to span two columns.)"
