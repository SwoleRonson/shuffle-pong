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

# Reset app to fresh setup state (clears players, rounds, etc.)
# After eval that modifies DOM, snapshot must run to re-index refs.
reset_app() {
  agent-browser eval "state.players = []; state.tableCount = 1; state.rounds = []; state.currentView = 'setup'; state.currentRound = 0; nextColorIndex = 0; renderSetup();" >/dev/null 2>&1
  agent-browser snapshot >/dev/null 2>&1
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
assert_snapshot_contains "schedule shows round status" "Round 1 of"
assert_snapshot_contains "schedule shows player pills" "Alice"
assert_snapshot_contains "schedule shows vs separator" "vs"
assert_snapshot_contains "schedule shows table format" "TABLE"

# Test: Edit Players returns to setup
# Get the Edit Players button ref from snapshot
EDIT_REF=$(agent-browser snapshot 2>&1 | grep "Edit Players" | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
click_ref "$EDIT_REF"
assert_snapshot_contains "edit returns to setup view" "Add player name"
assert_snapshot_contains "players preserved after edit" "Alice"

echo ""
echo "=== Round Navigation Tests ==="

# Re-generate schedule for round nav tests
click_ref e6
assert_snapshot_contains "Next Round button exists" "Next Round"

# Click Next Round
NEXT_REF=$(agent-browser snapshot 2>&1 | grep "Next Round" | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
click_ref "$NEXT_REF"
assert_snapshot_contains "advances to round 2" "Round 2 of"

# Keep clicking until we see Restart button
for i in $(seq 1 20); do
  snapshot=$(agent-browser snapshot 2>&1)
  if echo "$snapshot" | grep -q "Restart from Round 1"; then
    break
  fi
  REF=$(echo "$snapshot" | grep "Next Round" | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
  if [ -z "$REF" ]; then break; fi
  click_ref "$REF"
done
assert_snapshot_contains "last round shows restart button" "Restart from Round 1"

# Click restart — should wrap to round 1
RESTART_REF=$(agent-browser snapshot 2>&1 | grep "Restart" | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
click_ref "$RESTART_REF"
assert_snapshot_contains "restart wraps to round 1" "Round 1 of"

echo ""
echo "=== Schedule Quality Visual Checks ==="

# Start fresh: reset app state
reset_app

# Add 6 players for 6p/3t test (e2=input, e3=Add are stable refs)
fill_ref e2 "Alpha"
click_ref e3
fill_ref e2 "Bravo"
click_ref e3
fill_ref e2 "Charlie"
click_ref e3
fill_ref e2 "Delta"
click_ref e3
fill_ref e2 "Echo"
click_ref e3
fill_ref e2 "Foxtrot"
click_ref e3

# Increase tables to max (e5 = + button): 6 players -> min 2, max 3
click_ref e5
assert_snapshot_contains "6p/3t: table count is 3" '"3 / 3"'

# Generate schedule (e6 = Generate button)
click_ref e6
assert_snapshot_contains "6p/3t: all tables show SINGLES" "SINGLES"
assert_snapshot_not_contains "6p/3t: no doubles tables" "DOUBLES"

# Check player count in summary
assert_snapshot_contains "6p/3t: shows 6 players in summary" "6 players"

# Check round count in summary
assert_snapshot_contains "6p/3t: shows round count" "Round 1 of"

# Now test 4p/1t doubles: fresh setup with 4 players
reset_app
fill_ref e2 "P1"
click_ref e3
fill_ref e2 "P2"
click_ref e3
fill_ref e2 "P3"
click_ref e3
fill_ref e2 "P4"
click_ref e3

click_ref e6
assert_snapshot_contains "4p/1t: table shows DOUBLES" "DOUBLES"
assert_snapshot_contains "4p/1t: shows 4 players in summary" "4 players"

echo ""
echo "=== Player Management Edge Cases ==="

# Start fresh: reset app state
reset_app

# Test: cannot add empty player name
click_ref e3
assert_snapshot_not_contains "empty name not added (no pills)" "pill"

# Add a player named "Test"
fill_ref e2 "Test"
click_ref e3
assert_snapshot_contains "Test player added" "Test"

# Test: cannot add duplicate player name (case-insensitive)
fill_ref e2 "test"
click_ref e3
# "Test" should appear in snapshot exactly once as a StaticText inside a pill
snapshot=$(agent-browser snapshot 2>&1)
# Count lines matching StaticText "Test" (pill label) — should be 1
PILL_COUNT=$(echo "$snapshot" | grep -c 'StaticText "Test"')
if [ "$PILL_COUNT" -le 1 ]; then
  echo "  PASS: duplicate name (case-insensitive) rejected"
  inc PASS
else
  echo "  FAIL: duplicate name (case-insensitive) was added ($PILL_COUNT occurrences)"
  inc FAIL
fi

# Test: can add up to 14 players — start fresh
reset_app
for i in $(seq 1 14); do
  fill_ref e2 "Player$i"
  click_ref e3
done
assert_snapshot_contains "14 players added: shows Player14" "Player14"

# Test: adding 15th player is silently rejected (still shows 14)
fill_ref e2 "Player15"
click_ref e3
# Player count should still be 14 (verified via JS to avoid false match in input field)
snapshot=$(agent-browser eval "state.players.length" 2>&1)
if [ "$snapshot" = "14" ]; then
  echo "  PASS: 15th player rejected (player count still 14)"
  inc PASS
else
  echo "  FAIL: 15th player was added (count: $snapshot, expected 14)"
  inc FAIL
fi
assert_snapshot_contains "still shows 14 players in summary" "14 players"

echo ""
echo "=== Results ==="
echo "$PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
