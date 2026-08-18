#!/usr/bin/env bash
#
# check-layout.sh — check every page for horizontal overflow (content running
# off the right edge) and for the nav links row lining up with the masthead,
# at a phone-width viewport.
#
# Usage:
#   ./scripts/check-layout.sh                 # all pages at 375px
#   ./scripts/check-layout.sh 320             # all pages at 320px
#   ./scripts/check-layout.sh 375 /cv/ /es/   # just these pages
#
# What it reports, per page:
#   overflow  — does the page scroll sideways? (it never should)
#   nav       — do the section links start and end exactly where the
#               masthead text does? (they should, see .nav-links in style.css)
#
# Exits 0 if every page passes, 1 if any page fails, so it can gate a commit.
#
#
# ─── Why this is more complicated than "take a screenshot at 375px" ───
#
# On macOS the window manager refuses to make a window narrower than about
# 500px, and headless Chrome is still a real window. Asking for
# --window-size=375 therefore renders the page at ~500 CSS px and merely
# CROPS the screenshot to 375. Text near the right edge looks chopped off
# even when the layout is perfectly fine — which on 2026-08-18 produced a
# confident bug report about the CV page that turned out to be nothing.
#
# The fix is to stop resizing the window at all. An <iframe> gets its own
# viewport at exactly the width you give it, no matter how big the window
# is, so this loads each page inside a fixed-width iframe and measures from
# the inside via same-origin JavaScript.
#
# The numbers then come back as text, not pixels: the harness page writes
# its findings into the DOM and Chrome's --dump-dom prints the result to
# stdout. That's what makes this a pass/fail check rather than something
# you have to squint at.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "✗ Google Chrome not found at:"; echo "  $CHROME"; exit 1; }
command -v python3 >/dev/null || { echo "✗ python3 not found (needed to serve the site locally)."; exit 1; }

# --- arguments: an optional width, then optional page paths ---
WIDTH=375
if [ "${1:-}" ] && [[ "${1:-}" =~ ^[0-9]+$ ]]; then WIDTH="$1"; shift; fi

if [ "$#" -gt 0 ]; then
  PAGES=("$@")
else
  # Every page in the repo, found rather than hardcoded, so new sections and
  # future /es/ mirrors are covered without touching this script.
  # index.html becomes its folder URL (/cv/index.html -> /cv/); anything else
  # keeps its filename (404.html -> /404.html).
  PAGES=()
  while IFS= read -r f; do
    url="${f#.}"
    url="${url%index.html}"
    PAGES+=("$url")
  done < <(find . -name '*.html' -not -path './.git/*' -not -name '.layout-check.html' | sort)
fi

# --- serve the site, so the harness and the pages share one origin ---
# (same-origin is what lets the harness read inside the iframe at all)
PORT=8800
while lsof -i :"$PORT" >/dev/null 2>&1; do PORT=$((PORT + 1)); done
python3 -m http.server "$PORT" &>/dev/null &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true   # no "Terminated" notice when we kill it

# The harness has to live inside the repo to be same-origin with the pages,
# so it's written at the root as a hidden file and removed on the way out
# (including on Ctrl-C or an error, hence the trap).
HARNESS=".layout-check.html"
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; rm -f "$ROOT/$HARNESS"; }
trap cleanup EXIT

sleep 1

echo "Checking ${#PAGES[@]} pages at ${WIDTH}px wide"
echo

FAILED=0

for page in "${PAGES[@]}"; do
  cat > "$HARNESS" << HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<iframe id="f" src="$page" style="width:${WIDTH}px;height:900px;border:0"></iframe>
<pre id="out">pending</pre>
<script>
document.getElementById('f').addEventListener('load', function () {
  var d = this.contentDocument;
  var vw = d.documentElement.clientWidth;

  // Anything whose right edge lands past the viewport is overflowing.
  // Reported by name so a failure points at the culprit, not just "something".
  var over = [];
  d.querySelectorAll('body *').forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.right > vw + 0.5) {
      var id = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
      if (over.indexOf(id) === -1) over.push(id);
    }
  });

  // The nav links row is built to span exactly the masthead's width — same
  // left edge, same right edge — on phone as well as desktop. Any drift here
  // is the bug fixed on 2026-08-18, coming back.
  //
  // Measured with a Range over each element's CONTENTS, not the elements
  // themselves. A grid item stretches to fill its column, so when the nav
  // is full-bleed both boxes report the same width while the text inside
  // them visibly ends in different places — an element-box check reads a
  // perfect 0 and sails straight past the bug. The Range gives the real
  // extent of the glyphs: for the masthead its text, for the links row the
  // span from the first link's left edge to the last link's right edge.
  var name = d.querySelector('.nav-name');
  var links = d.querySelector('.nav-links');
  var dL = 'n/a', dR = 'n/a';
  if (name && links) {
    var textRect = function (el) {
      var range = d.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };
    var n = textRect(name), l = textRect(links);
    dL = (l.left - n.left).toFixed(1);
    dR = (l.right - n.right).toFixed(1);
  }

  // Split marker: keeps this script's own source from matching the grep
  // that reads the result back out of the dumped DOM.
  document.getElementById('out').textContent =
    'RES' + 'ULT|vw=' + vw +
    '|scrollw=' + d.documentElement.scrollWidth +
    '|dl=' + dL + '|dr=' + dR +
    '|over=' + (over.length ? over.join(',') : 'none');
});
</script></body></html>
HTML

  raw="$("$CHROME" --headless --disable-gpu --dump-dom --virtual-time-budget=4000 \
        "http://localhost:$PORT/$HARNESS" 2>/dev/null | grep -oE 'RESULT\|vw=[^<]*' || true)"

  if [ -z "$raw" ]; then
    printf '  ✗ %-34s could not measure (page failed to load?)\n' "$page"
    FAILED=$((FAILED + 1))
    continue
  fi

  field() { printf '%s' "$raw" | tr '|' '\n' | grep "^$1=" | cut -d= -f2-; }
  vw="$(field vw)"; scrollw="$(field scrollw)"
  dl="$(field dl)"; dr="$(field dr)"; over="$(field over)"

  problems=""
  [ "$scrollw" -gt "$vw" ] && problems="${problems}scrolls sideways (${scrollw}px in a ${vw}px viewport); "
  [ "$over" != "none" ] && problems="${problems}overflowing: ${over}; "
  # Sub-pixel rounding is fine; anything a whole pixel or more is real drift.
  case "$dl" in n/a) ;; *) awk -v a="$dl" 'BEGIN{exit (a<1 && a>-1) ? 0 : 1}' || problems="${problems}nav left edge off by ${dl}px; ";; esac
  case "$dr" in n/a) ;; *) awk -v a="$dr" 'BEGIN{exit (a<1 && a>-1) ? 0 : 1}' || problems="${problems}nav right edge off by ${dr}px; ";; esac

  if [ -z "$problems" ]; then
    printf '  ✓ %-34s no overflow, nav flush\n' "$page"
  else
    printf '  ✗ %-34s %s\n' "$page" "${problems%; }"
    FAILED=$((FAILED + 1))
  fi
done

echo
if [ "$FAILED" -eq 0 ]; then
  echo "✓ All ${#PAGES[@]} pages pass at ${WIDTH}px."
else
  echo "✗ $FAILED of ${#PAGES[@]} pages have layout problems at ${WIDTH}px."
  exit 1
fi
