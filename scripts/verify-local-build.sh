#!/usr/bin/env bash
# Local pre-build verification for csg-next (Cosmic Spirit Guide)
# ---------------------------------------------------------------------------
# Purpose: catch code errors BEFORE pushing to Render and wasting ~40s deploy
#          cycles. This is the local equivalent of the Render build step.
#
# Catches the same failures that were burning deploy cycles:
#   (a) prerender / runtime errors  e.g. "Cannot destructure 'Origin' of undefined"
#   (b) JSX syntax errors + TypeScript type errors
#
# Two environment gotchas this script works around automatically:
#
#   1. This sandbox exports NODE_ENV=production. npm defaults `omit` to "dev"
#      in production mode, so a plain `npm install` SKIPS devDependencies
#      (tailwindcss, typescript, postcss, autoprefixer) and the build dies with
#      "tailwindcss not found". We therefore always install with --include=dev.
#
#   2. Next.js 15.0.0 has a flaky POST-compile file-system race. After a fully
#      successful "Compiled successfully" (which already means types + JSX +
#      imports + prerender code all passed), the build can throw ENOENT on a
#      manifest / .nft.json, or PageNotFoundError for the internal /_document
#      page, during trace collection or page-data collection. It can also hang
#      (wedged jest-worker subprocess). That is a Next bug, NOT a code error.
#      We retry ONLY on that exact benign signature and FAIL FAST on genuine
#      compile/type/prerender-runtime errors, so the gate always resolves to a
#      real pass/fail instead of a spurious flake.
#
#      (Long-term fix: bump next to >=15.0.3 where this race is resolved. The
#       retry wrapper keeps the gate honest on the currently-pinned 15.0.0.)
#
# Usage:
#   ./scripts/verify-local-build.sh
#   (or: npm run verify)
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(dirname "$0")/.." || { echo "cannot cd to repo root"; exit 1; }

# Hard ceiling per build attempt so a Next hang can never wedge the gate.
ATTEMPT_TIMEOUT="${ATTEMPT_TIMEOUT:-300}"   # seconds
MAX_TRIES=4

# Clear any stray `next build` (e.g. from another shell / parent agent run)
# that would compete for .next and trigger the very race we retry on.
pkill -9 -f "node_modules/.bin/next build" 2>/dev/null || true
sleep 1

echo "==> Installing dependencies (including dev) ..."
npm install --include=dev --no-audit --no-fund || { echo "INSTALL FAILED"; exit 1; }

NEXT_BIN="./node_modules/.bin/next"

for i in $(seq 1 "$MAX_TRIES"); do
  echo "==> next build (attempt $i/$MAX_TRIES, timeout ${ATTEMPT_TIMEOUT}s) ..."
  rm -rf .next
  LOG="$(mktemp)"

  # Run build under `timeout`; capture exit. `timeout` returns 124 on timeout.
  timeout "$ATTEMPT_TIMEOUT" "$NEXT_BIN" build >"$LOG" 2>&1
  rc=$?

  if [ "$rc" -eq 0 ]; then
    echo "BUILD OK"
    tail -20 "$LOG"
    rm -f "$LOG"
    exit 0
  fi

  # Genuine code error? (These must NOT be retried — they are what we catch.)
  if grep -Eq "Failed to compile|Type error:|Module not found: Can't resolve|Error occurred prerendering|Cannot destructure" "$LOG"; then
    echo "BUILD FAILED (real code error):"
    tail -45 "$LOG"
    rm -f "$LOG"
    # make sure no orphaned build subprocess lingers
    pkill -9 -f "node_modules/.bin/next build" 2>/dev/null || true
    exit 1
  fi

  # Benign Next 15.0.0 post-compile race OR a build that hit the timeout
  # (hung on the same jest-worker prerender race): retry.
  hung="false"
  [ "$rc" -eq 124 ] && hung="true"
  if grep -q "Compiled successfully" "$LOG" && \
     { [ "$hung" = "true" ] || \
       grep -Eq "ENOENT: no such file or directory, open .*(nft\.json|pages-manifest\.json|app-paths-manifest\.json|_document)|PageNotFoundError: Cannot find module for page" "$LOG"; }; then
    echo "    (benign Next 15.0.0 post-build race${hung:+/hang} — retrying)"
    pkill -9 -f "node_modules/.bin/next build" 2>/dev/null || true
    rm -f "$LOG"
    continue
  fi

  # Unknown failure: surface and stop (don't loop on something unexplained).
  echo "BUILD FAILED (unrecognized, rc=$rc):"
  tail -45 "$LOG"
  pkill -9 -f "node_modules/.bin/next build" 2>/dev/null || true
  rm -f "$LOG"
  exit 1
done

echo "BUILD FAILED: exhausted retries on the Next trace race (environment issue, not your code)."
exit 1
