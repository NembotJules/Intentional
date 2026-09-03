#!/usr/bin/env bash
# Launch Expo web on a known port and wait for HTTP 200

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
EXPO_DIR="$WORKSPACE_ROOT/intentional-expo"
RUN_FILE="$SKILL_DIR/evidence/.run"
PORT="${EXPO_WEB_PORT:-8081}"

if [ -f "$RUN_FILE" ]; then
  echo "Error: Run file already exists at $RUN_FILE"
  echo "Either cleanup the previous instance or use a different port."
  exit 1
fi

cd "$EXPO_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start expo web in the background
echo "Starting Expo web on port $PORT..."
PORT="$PORT" npx expo start --web --port "$PORT" > "$SKILL_DIR/evidence/expo-output.log" 2>&1 &
EXPO_PID=$!

echo "$EXPO_PID" > "$RUN_FILE"
echo "$PORT" >> "$RUN_FILE"

echo "Expo web starting with PID $EXPO_PID on port $PORT"
echo "Waiting for HTTP 200..."

# Wait up to 120 seconds for the server to respond
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" | grep -q "200"; then
    echo "✓ Expo web is ready on http://localhost:$PORT"
    exit 0
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "Error: Expo process died during startup"
    tail -n 50 "$SKILL_DIR/evidence/expo-output.log"
    rm -f "$RUN_FILE"
    exit 1
  fi
done

echo "Error: Timed out waiting for Expo web to start"
tail -n 50 "$SKILL_DIR/evidence/expo-output.log"
kill "$EXPO_PID" 2>/dev/null || true
rm -f "$RUN_FILE"
exit 1
