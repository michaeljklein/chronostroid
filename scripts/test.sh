#!/usr/bin/env bash
set -euo pipefail
# Run unit tests with Vitest.
cd "$(dirname "$0")/.."

n exec stable npx vitest run --passWithNoTests "$@"
