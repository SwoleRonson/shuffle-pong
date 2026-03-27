#!/bin/bash
# UI tests using agent-browser
# Run: ./tests/test-ui.sh

set -euo pipefail

# Arithmetic helper that avoids set -e tripping on ((0++))
inc() { eval "$1=\$(( $1 + 1 ))"; }

PASS=0
FAIL=0
PORT=8099
DIR="$(cd "$(dirname "$0")/.." && pwd)"

# --- Helpers ---

assert_snapshot_contains() {
  local label="$1"
  local pattern="$2"
  local snapshot
  snapshot=$(agent-browser snapshot 2>&1)
  if echo "$snapshot" | grep -q "$pattern"; then
    echo "  PASS: $label"
    inc PASS
  else
    echo "  FAIL: $label"
    echo "        Expected to find: $pattern"
    echo "        Snapshot: $(echo "$snapshot" | head -5)..."
    inc FAIL
  fi
}

assert_snapshot_not_contains() {
  local label="$1"
  local pattern="$2"
  local snapshot
  snapshot=$(agent-browser snapshot 2>&1)
  if echo "$snapshot" | grep -q "$pattern"; then
    echo "  FAIL: $label"
    echo "        Did not expect to find: $pattern"
    inc FAIL
  else
    echo "  PASS: $label"
    inc PASS
  fi
}

click_ref() {
  agent-browser click "$1" >/dev/null 2>&1
}

fill_ref() {
  agent-browser fill "$1" "$2" >/dev/null 2>&1
}

# Get a value from the snapshot by pattern (returns the line)
snapshot_line() {
  agent-browser snapshot 2>&1 | grep "$1"
}

# --- Server lifecycle ---

start_server() {
  /opt/homebrew/bin/node -e "
    const http = require('http');
    const fs = require('fs');
    const server = http.createServer((req, res) => {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(fs.readFileSync('$DIR/index.html', 'utf-8'));
    });
    server.listen($PORT, () => console.log('ready'));
  " &
  SERVER_PID=$!
  sleep 1
}

stop_server() {
  kill $SERVER_PID 2>/dev/null || true
}

trap stop_server EXIT

# --- Start ---

echo "Starting server on port $PORT..."
start_server

echo "Opening browser..."
agent-browser open "http://localhost:$PORT" >/dev/null 2>&1

echo ""
echo "=== Setup View Tests ==="

# Test: Initial state
assert_snapshot_contains "generate button is disabled initially" 'button "Generate Schedule →" \[disabled'
assert_snapshot_contains "shows add-player hint" "Add at least 2 players"
assert_snapshot_contains "table count starts at 1" 'StaticText "1 / 1"'

# Test: Add players
fill_ref e2 "Alice"
click_ref e3
assert_snapshot_contains "Alice pill appears after adding" "Alice"

fill_ref e2 "Bob"
click_ref e3
assert_snapshot_contains "Bob pill appears after adding" "Bob"
assert_snapshot_not_contains "generate button enabled with 2 players" 'button "Generate Schedule →" \[disabled'

fill_ref e2 "Carol"
click_ref e3
fill_ref e2 "Dave"
click_ref e3

# Test: Table stepper with 4 players (min=1, max=2)
assert_snapshot_contains "4 players: table count shows max 2" '/ 2"'

# Click + to increment
click_ref e5
assert_snapshot_contains "table count increments to 2" '"2 / 2"'

# + should be disabled at max
assert_snapshot_contains "+ disabled at max" 'button "+" \[disabled'

# Click - to decrement
click_ref e4
assert_snapshot_contains "table count decrements to 1" '"1 / 2"'

# - should be disabled at min
assert_snapshot_contains "- disabled at min (1)" 'button "−" \[disabled'

# Test: Add 5th player — min tables should become 2
fill_ref e2 "Eve"
click_ref e3
assert_snapshot_contains "5 players: min tables is 2, count auto-clamped" '"2 / 2"'
assert_snapshot_contains "both buttons disabled when min=max" 'button "−" \[disabled'

# Test: Remove a player — back to 4
click_ref e11
assert_snapshot_contains "after removing Eve, back to 4 players, table count preserved" '"2 / 2"'
assert_snapshot_not_contains "Eve removed from pills" "Eve"

echo ""
echo "=== Schedule View Tests ==="

# Set 2 tables and generate
click_ref e5
click_ref e6
assert_snapshot_contains "schedule view shows round cards" "Round 1"
assert_snapshot_contains "schedule view shows Edit Players button" "Edit Players"
assert_snapshot_contains "schedule view shows cycling message" "Repeats from round 1"
assert_snapshot_contains "schedule shows player pills" "Alice"
assert_snapshot_contains "schedule shows vs separator" "vs"
assert_snapshot_contains "schedule shows table format" "TABLE"

# Test: Edit Players returns to setup
click_ref e2
assert_snapshot_contains "edit returns to setup view" "Add player name"
assert_snapshot_contains "players preserved after edit" "Alice"

echo ""
echo "=== Results ==="
echo "$PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
