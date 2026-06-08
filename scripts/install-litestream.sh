#!/usr/bin/env sh
# Download the Litestream binary into the local bin (used by start.sh to
# replicate the SQLite DB to object storage). Runs in Render's build step.
# No-op friendly: if the download fails the server still starts (ephemeral).
set -e

LITESTREAM_VERSION="${LITESTREAM_VERSION:-0.3.13}"
BIN_DIR="$(pwd)/.bin"
mkdir -p "$BIN_DIR"

# Detect arch (Render is linux/amd64; keep arm64 for local use).
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) LS_ARCH=amd64 ;;
  aarch64|arm64) LS_ARCH=arm64 ;;
  *) echo "[litestream] unsupported arch $ARCH — skipping"; exit 0 ;;
esac

URL="https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${LS_ARCH}.tar.gz"
echo "[litestream] downloading $URL"
if curl -fsSL "$URL" | tar -xz -C "$BIN_DIR" 2>/dev/null; then
  chmod +x "$BIN_DIR/litestream"
  echo "[litestream] installed -> $BIN_DIR/litestream"
else
  echo "[litestream] download failed — server will run WITHOUT persistence"
fi
