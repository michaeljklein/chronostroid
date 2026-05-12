#!/usr/bin/env bash
set -euo pipefail
# Start Vite dev server + RCade dev emulator on a free port.
# Prefers 5173; falls back to a random high port if 5173 is in use.
cd "$(dirname "$0")/.."

PREFERRED_PORT=5173

port_free() {
    ! nc -z localhost "$1" >/dev/null 2>&1
}

pick_port() {
    if port_free "$PREFERRED_PORT"; then
        echo "$PREFERRED_PORT"
        return
    fi
    echo "Port $PREFERRED_PORT in use; selecting a random free port..." >&2
    for _ in $(seq 1 50); do
        candidate=$(( (RANDOM % 16384) + 49152 ))
        if port_free "$candidate"; then
            echo "$candidate"
            return
        fi
    done
    echo "scripts/dev.sh: failed to find a free port after 50 attempts" >&2
    exit 1
}

PORT="$(pick_port)"
URL="http://localhost:$PORT"
echo "Vite + RCade dev on $URL"

exec n exec stable npx concurrently --kill-others-on-fail \
    "n exec stable npx vite --port $PORT --strictPort" \
    "n exec stable npx rcade dev $URL" \
    "$@"
