#!/usr/bin/env sh
# Server entrypoint.
#
# If Litestream is configured (LITESTREAM_REPLICA_URL set) we:
#   1. restore the SQLite DB from object storage if it's missing locally
#      (this is what survives Render redeploys / restarts / spin-downs), then
#   2. run the server UNDER litestream so every write is replicated live.
# If Litestream is NOT configured, we just run the server directly — the app
# behaves exactly as before (ephemeral SQLite), so nothing breaks without it.
set -e

: "${GIT1_DB:=git1.db}"
export GIT1_DB

# install-litestream.sh drops the binary in ./.bin (relative to server/).
PATH="$(pwd)/.bin:$PATH"
export PATH

run_server() {
  exec npm start
}

if [ -n "$LITESTREAM_REPLICA_URL" ] && command -v litestream >/dev/null 2>&1; then
  echo "[start] Litestream enabled -> $LITESTREAM_REPLICA_URL (db=$GIT1_DB)"
  if [ ! -f "$GIT1_DB" ]; then
    echo "[start] local DB missing; attempting restore from replica..."
    litestream restore -if-replica-exists -config litestream.yml "$GIT1_DB" || \
      echo "[start] no replica to restore (first run) — starting fresh"
  fi
  exec litestream replicate -config litestream.yml -exec "npm start"
else
  if [ -n "$LITESTREAM_REPLICA_URL" ]; then
    echo "[start] WARNING: LITESTREAM_REPLICA_URL set but litestream binary not found — running WITHOUT persistence"
  else
    echo "[start] Litestream not configured — ephemeral SQLite (data resets on redeploy)"
  fi
  run_server
fi
