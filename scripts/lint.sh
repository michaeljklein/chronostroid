#!/usr/bin/env bash
set -euo pipefail
# Type-check with tsc, then lint with ESLint. Fails on any error or warning.
cd "$(dirname "$0")/.."

n exec stable npx tsc --noEmit
n exec stable npx eslint src "$@"
