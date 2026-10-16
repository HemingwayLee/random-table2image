#!/usr/bin/env bash
# Generates N random table images plus a random-rectangle mask for each, ready
# for LaMa training/validation (image.png + image_mask001.png pairs).
#
# Usage:
#   ./generate.sh <N> <folder>
#
#   N       Number of image+mask pairs to generate.
#   folder  Output folder (created if missing).

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <N> <folder>" >&2
  exit 1
fi

N="$1"
OUTDIR="$2"

if ! [[ "$N" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: N must be a positive integer, got '$N'" >&2
  exit 1
fi

CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/core"

if [ ! -d "$CORE_DIR/node_modules" ]; then
  echo "Installing Node dependencies in $CORE_DIR ..."
  npm install --prefix "$CORE_DIR"
fi

node "$CORE_DIR/generate_dataset.js" "$N" "$OUTDIR"
