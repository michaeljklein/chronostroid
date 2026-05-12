#!/usr/bin/env bash
set -euo pipefail
# Start Vite dev server + RCade dev emulator.
cd "$(dirname "$0")/.."

n exec stable npm run dev "$@"
