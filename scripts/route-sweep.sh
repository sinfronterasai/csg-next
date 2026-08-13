#!/usr/bin/env bash
# Route hygiene sweep for the Cosmic Profile Hub.
# Extracts every internal link target (/foo, /foo/bar, /profile?tab=...) referenced
# in source (href="...", Link href=..., router.push('...')) and curls each.
# Auth-gated routes (return 401) still count as "real destination" (200/401 ok; 404 fails).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE_URL:-http://127.0.0.1:5000}"
cd "$ROOT"

# Collect candidate internal paths
paths=$(grep -rhoE '(href=|router\.push\()"/[a-zA-Z0-9_/?=&.-]+"' src 2>/dev/null \
        | sed -E 's/.*"(\/[^"]+)".*/\1/' \
        | sed -E "s/['\"]//g" \
        | grep -vE '\?tab=' \
        | sort -u)

if [ -z "$paths" ]; then
  echo "FAIL: no internal link targets extracted — sweep checked nothing."
  exit 1
fi

fail=0
echo "=== Route sweep against $BASE ==="
for p in $paths; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$BASE$p" || echo "000")
  if [ "$code" = "404" ] || [ "$code" = "000" ]; then
    echo "BROKEN  $code  $p"
    fail=1
  else
    echo "ok      $code  $p"
  fi
done
echo "=== sweep done (fail=$fail) ==="
exit $fail
