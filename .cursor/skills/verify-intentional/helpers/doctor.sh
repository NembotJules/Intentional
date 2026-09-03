#!/usr/bin/env bash
# Check if the Expo web instance is healthy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
RUN_FILE="$SKILL_DIR/evidence/.run"

if [ ! -f "$RUN_FILE" ]; then
  echo "Error: No run file found at $RUN_FILE"
  echo "Launch the app first using launch.sh"
  exit 1
fi

PID=$(head -n 1 "$RUN_FILE")
PORT=$(tail -n 1 "$RUN_FILE")

# Check if process is alive
if ! kill -0 "$PID" 2>/dev/null; then
  echo "Error: Process $PID is not running"
  exit 1
fi

# Check if port is in use (may be owned by child process)
if ! lsof -ti ":$PORT" &>/dev/null; then
  echo "Error: Port $PORT is not in use"
  exit 1
fi

# Check HTTP 200
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  echo "Error: HTTP returned $HTTP_CODE instead of 200"
  exit 1
fi

echo "✓ Expo web is healthy (PID $PID, port $PORT, HTTP 200)"
exit 0
