#!/usr/bin/env bash
set -euo pipefail
# Build production output via Vite.
cd "$(dirname "$0")/.."

n exec stable npm run build "$@"
