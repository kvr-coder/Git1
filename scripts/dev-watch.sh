#!/usr/bin/env bash
# Auto-pull from origin and run the Expo dev server with a tunnel so your
# phone can connect from anywhere (mobile data or different Wi-Fi).
#
# Usage:
#   ./scripts/dev-watch.sh                # pulls current branch every 5s
#   PULL_INTERVAL=10 ./scripts/dev-watch.sh
#
# Stop with Ctrl+C — the background pull loop is cleaned up automatically.

set -euo pipefail

PULL_INTERVAL="${PULL_INTERVAL:-5}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "Watching branch: $BRANCH (pull every ${PULL_INTERVAL}s)"

(
  while true; do
    git pull --quiet origin "$BRANCH" || echo "[dev-watch] pull failed, retrying"
    sleep "$PULL_INTERVAL"
  done
) &
PULL_PID=$!

cleanup() {
  kill "$PULL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npx expo start --tunnel
