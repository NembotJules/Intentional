#!/usr/bin/env bash
# Clean up the Expo web instance (kill PID, remove run file, keep evidence)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
RUN_FILE="$SKILL_DIR/evidence/.run"

if [ ! -f "$RUN_FILE" ]; then
  echo "No run file found at $RUN_FILE - nothing to clean up"
  exit 0
fi

PID=$(head -n 1 "$RUN_FILE")
PORT=$(tail -n 1 "$RUN_FILE")

echo "Cleaning up Expo web instance (PID $PID, port $PORT)..."

# Kill the process
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  sleep 1
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null || true
  fi
  echo "✓ Killed process $PID"
else
  echo "Process $PID was already dead"
fi

# Remove run file
rm -f "$RUN_FILE"
echo "✓ Removed run file"
echo "✓ Evidence artifacts preserved in $SKILL_DIR/evidence/"
