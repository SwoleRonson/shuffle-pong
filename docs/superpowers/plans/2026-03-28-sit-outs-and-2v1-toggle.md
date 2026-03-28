# Sit-outs & 2v1 Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **TDD is mandatory** — every logic change must have a failing test written first.

**Goal:** Allow fewer tables than players (some sit out with fair rotation) and let users toggle 2v1 format on/off.

**Architecture:** Wrap the existing scheduler with a sit-out layer that selects which players play each round, rotating evenly. Add `allow2v1` parameter to `decideTableFormats` to skip 3-player tables. UI gets a checkbox toggle and sit-out display per round card.

**Tech Stack:** Vanilla JS in `index.html`, unit tests in `tests/test-scheduler.mjs` (worker threads), UI tests in `tests/test-ui.sh` (agent-browser)

**Spec:** `docs/superpowers/specs/2026-03-28-sit-outs-and-2v1-toggle-design.md`

---

## File Map

- **Modify:** `index.html` — all changes (scheduler logic, state, UI rendering, event handlers)
- **Modify:** `tests/test-scheduler.mjs` — new unit tests for `allow2v1` and sit-out logic
- **Modify:** `tests/test-ui.sh` — new UI tests for toggle and sit-out display, update `reset_app` for new state

---

### Task 1: `decideTableFormats` — add `allow2v1` parameter

**Files:**
- Modify: `tests/test-scheduler.mjs` — add tests inside `allTests()`
- Modify: `index.html:56-94` — update `decideTableFormats`

- [ ] **Step 1: Write failing tests for `allow2v1=false`**

Add these tests inside the `allTests()` function in `tests/test-scheduler.mjs`, after the existing `decideTableFormats` tests (after the "6 players, 3 tables" test):

```javascript
// --- decideTableFormats with allow2v1=false ---

test('allow2v1=false: 5p/2t → [2,2] (no 2v1, 1 sits out)', (S) => {
  const formats = S.decideTableFormats(5, 2, false);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [2, 2]);
});

test('allow2v1=false: 7p/3t → [2,2,2] (no 2v1, 1 sits out)', (S) => {
  const formats = S.decideTableFormats(7, 3, false);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [2, 2, 2]);
});

test('allow2v1=false: 7p/2t → [4,2] (no 2v1, 1 sits out)', (S) => {
  const formats = S.decideTableFormats(7, 2, false);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 2]);
});

test('allow2v1=false: 3p/1t → [2] (no 2v1, 1 sits out)', (S) => {
  const formats = S.decideTableFormats(3, 1, false);
  assert.deepStrictEqual(formats, [2]);
});

test('allow2v1=true: 5p/2t → [3,2] (2v1 allowed, backward compat)', (S) => {
  const formats = S.decideTableFormats(5, 2, true);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [3, 2]);
});

test('allow2v1 default: 5p/2t → [3,2] (default is true)', (S) => {
  const formats = S.decideTableFormats(5, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [3, 2]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: The `allow2v1=false` tests fail (they return `[3,2]` instead of `[2,2]` because the parameter is ignored).

- [ ] **Step 3: Implement `allow2v1` parameter**

In `index.html`, update the `decideTableFormats` function signature and body. Change line 56:

```javascript
function decideTableFormats(playerCount, tableCount, allow2v1 = true) {
```

Then inside the loop, after line 83 (`for (let i = 0; i < extra; i++) formats.push(3);`), add a guard to skip combinations with 3-player tables when `allow2v1` is false. Replace lines 83-88:

```javascript
        const formats = Array(d).fill(4);
        for (let i = 0; i < extra; i++) formats.push(3);
        for (let i = 0; i < remaining - extra; i++) formats.push(2);

        if (!allow2v1 && extra > 0) continue;

        if (!best || extra < best.threes || (extra === best.threes && formats.length > best.formats.length)) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: All tests pass including the new `allow2v1` tests. Existing tests still pass since the default is `true`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/test-scheduler.mjs
git commit -m "feat: add allow2v1 parameter to decideTableFormats"
```

---

### Task 2: `decideTableFormats` — support fewer tables than players (sit-out capacity)

**Files:**
- Modify: `tests/test-scheduler.mjs` — add tests for under-capacity configs
- Modify: `index.html:56-94` — update `decideTableFormats` to handle `playerCount > maxCapacity`

Currently `decideTableFormats` caps `maxTables = Math.min(tableCount, Math.floor(playerCount / 2))`. This means it always tries to seat all players. When table capacity is less than player count, it needs to return the best format for the tables available and let the caller figure out how many sit out.

- [ ] **Step 1: Write failing tests for under-capacity configs**

Add these tests in `allTests()` after the Task 1 tests:

```javascript
// --- decideTableFormats with fewer tables than needed (sit-out scenarios) ---

test('under-capacity: 8p/1t → [4] (doubles, 4 sit out)', (S) => {
  const formats = S.decideTableFormats(8, 1);
  assert.deepStrictEqual(formats, [4]);
});

test('under-capacity: 10p/2t → [4,4] (8 play, 2 sit out)', (S) => {
  const formats = S.decideTableFormats(10, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
});

test('under-capacity: 6p/1t → [4] (doubles preferred over singles)', (S) => {
  const formats = S.decideTableFormats(6, 1);
  assert.deepStrictEqual(formats, [4]);
});

test('under-capacity: 12p/2t → [4,4] (8 play, 4 sit out)', (S) => {
  const formats = S.decideTableFormats(12, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
});

test('under-capacity: 9p/2t, allow2v1=true → [4,3] (7 play, 2 sit out)', (S) => {
  const formats = S.decideTableFormats(9, 2, true);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 3]);
});

test('under-capacity: 9p/2t, allow2v1=false → [4,4] (8 play, 1 sits out)', (S) => {
  const formats = S.decideTableFormats(9, 2, false);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: Tests like `8p/1t → [4]` fail because the current function returns `[4,4]` (it finds 2 doubles for 8 players) or returns the current behavior which seats everyone.

- [ ] **Step 3: Implement under-capacity support**

The key change: `decideTableFormats` currently iterates `playerCount` worth of players into the format combinations. Instead, it should iterate all valid format combinations for the given `tableCount` (up to `maxCapacity = tableCount * 4`), and pick the one that seats the most players without exceeding `playerCount`. Replace the entire `decideTableFormats` function in `index.html`:

```javascript
  function decideTableFormats(playerCount, tableCount, allow2v1 = true) {
    const maxTables = Math.min(tableCount, Math.floor(playerCount / 2));

    let best = null;

    for (let numTables = 1; numTables <= maxTables; numTables++) {
      for (let d = numTables; d >= 0; d--) {
        const remaining = numTables - d;
        const doublesPlayers = d * 4;

        if (remaining === 0) {
          // All doubles tables
          const seated = doublesPlayers;
          if (seated > playerCount) continue;
          const formats = Array(d).fill(4);
          if (!best || seated > best.seated || (seated === best.seated && (formats.length > best.formats.length || (formats.length === best.formats.length && 0 < best.threes)))) {
            best = { formats, threes: 0, seated };
          }
          continue;
        }

        // Remaining tables are singles (2) or 2v1 (3)
        // Try all valid splits of remaining tables into 3s and 2s
        const maxThrees = allow2v1 ? remaining : 0;
        for (let threes = 0; threes <= maxThrees; threes++) {
          const twos = remaining - threes;
          const seated = doublesPlayers + threes * 3 + twos * 2;
          if (seated > playerCount) continue;

          const formats = Array(d).fill(4);
          for (let i = 0; i < threes; i++) formats.push(3);
          for (let i = 0; i < twos; i++) formats.push(2);

          if (!best
            || seated > best.seated
            || (seated === best.seated && threes < best.threes)
            || (seated === best.seated && threes === best.threes && formats.length > best.formats.length)) {
            best = { formats, threes, seated };
          }
        }
      }
    }

    return best ? best.formats : [];
  }
```

The key change vs the old version: we now maximize `seated` (most players playing) first, then minimize `threes` (2v1 tables), then maximize `formats.length` (more tables). The `seated <= playerCount` constraint allows returning formats that don't seat everyone.

- [ ] **Step 4: Run tests to verify they pass**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: ALL tests pass — both old and new. The new function produces identical results for cases where everyone fits, and correct under-capacity results for the new tests.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/test-scheduler.mjs
git commit -m "feat: decideTableFormats supports under-capacity (sit-out scenarios)"
```

---

### Task 3: `generateSchedule` — sit-out wrapper

**Files:**
- Modify: `tests/test-scheduler.mjs` — add sit-out scheduling tests
- Modify: `index.html:496-603` — update `generateSchedule`

- [ ] **Step 1: Write failing tests for sit-out scheduling**

Add these tests in `allTests()`:

```javascript
// --- Sit-out scheduling ---

test('sit-out: 6p/1t produces rounds with sittingOut array', (S) => {
  const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = S.generateSchedule(players, 1, true);
  assert.ok(rounds.length > 0);
  for (const round of rounds) {
    assert.ok(Array.isArray(round.sittingOut), 'round should have sittingOut array');
    assert.strictEqual(round.sittingOut.length, 2, '6p/1t(doubles): 2 sit out');
    // Active players + sitting out = all players
    const active = new Set();
    for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) active.add(p.name);
    const bench = new Set(round.sittingOut.map(p => p.name));
    assert.strictEqual(active.size + bench.size, 6);
    // No overlap
    for (const name of bench) assert.ok(!active.has(name), `${name} is both active and sitting out`);
  }
});

test('sit-out: rotation is fair (max - min <= 1)', (S) => {
  const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = S.generateSchedule(players, 1, true);
  const sitCounts = {};
  for (const p of players) sitCounts[p.name] = 0;
  for (const round of rounds) {
    for (const p of round.sittingOut) sitCounts[p.name]++;
  }
  const counts = Object.values(sitCounts);
  const diff = Math.max(...counts) - Math.min(...counts);
  assert.ok(diff <= 1, `Sit-out fairness: max-min=${diff}, counts=${JSON.stringify(sitCounts)}`);
});

test('sit-out: no sit-outs when capacity >= players', (S) => {
  const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = S.generateSchedule(players, 2, true);
  for (const round of rounds) {
    assert.ok(!round.sittingOut || round.sittingOut.length === 0,
      'no sit-outs when tables have enough capacity');
  }
});

test('sit-out: 8p/1t — 4 play, 4 sit out each round', (S) => {
  const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = S.generateSchedule(players, 1, true);
  for (const round of rounds) {
    assert.strictEqual(round.sittingOut.length, 4);
    const active = new Set();
    for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) active.add(p.name);
    assert.strictEqual(active.size, 4);
  }
});

test('sit-out: 10p/2t — 2 sit out each round', (S) => {
  const players = Array.from({ length: 10 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = S.generateSchedule(players, 2, true);
  for (const round of rounds) {
    // 10p/2t -> [4,4] = 8 capacity, 2 sit out
    assert.strictEqual(round.sittingOut.length, 2);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: Fails — `round.sittingOut` is undefined, and `generateSchedule` doesn't accept a third parameter.

- [ ] **Step 3: Implement sit-out wrapper in `generateSchedule`**

Update `generateSchedule` in `index.html`. Change the signature and add sit-out logic. Replace the entire function:

```javascript
  function generateSchedule(players, tableCount, allow2v1 = true) {
    const n = players.length;
    const formats = decideTableFormats(n, tableCount, allow2v1);
    const capacity = formats.reduce((a, b) => a + b, 0);
    const sitOutCount = n - capacity;
    const maxRounds = 20;

    if (sitOutCount <= 0) {
      // No sit-outs — use existing logic
      return generateScheduleFullField(players, formats);
    }

    // Sit-out mode: build rounds one at a time, rotating who sits out
    const opp = Array.from({ length: n }, () => Array(n).fill(0));
    const par = Array.from({ length: n }, () => Array(n).fill(0));
    const sitCounts = Array(n).fill(0);
    const rounds = [];

    while (rounds.length < maxRounds) {
      // Pick sit-out players: those with fewest sit-outs, break ties randomly
      const indices = Array.from({ length: n }, (_, i) => i);
      indices.sort((a, b) => sitCounts[a] - sitCounts[b] || (Math.random() - 0.5));
      const benchIndices = indices.slice(n - sitOutCount);
      const activeIndices = indices.slice(0, n - sitOutCount);

      const activePlayers = activeIndices.map(i => players[i]);
      const benchPlayers = benchIndices.map(i => players[i]);
      for (const bi of benchIndices) sitCounts[bi]++;

      // Build sub-matrices for active players (indexed into full matrix)
      const subOpp = activeIndices.map(i => activeIndices.map(j => opp[i][j]));
      const subPar = activeIndices.map(i => activeIndices.map(j => par[i][j]));

      const round = assignRound(activePlayers, formats, subOpp, subPar);
      round.sittingOut = benchPlayers;
      rounds.push(round);

      // Update full matrices
      for (const table of round.tables) {
        for (const a of table.sideA) for (const b of table.sideB) {
          const ai = players.indexOf(a);
          const bi = players.indexOf(b);
          opp[ai][bi]++; opp[bi][ai]++;
        }
        for (const side of [table.sideA, table.sideB])
          for (let i = 0; i < side.length; i++)
            for (let j = i + 1; j < side.length; j++) {
              const ai = players.indexOf(side[i]);
              const bi = players.indexOf(side[j]);
              par[ai][bi]++; par[bi][ai]++;
            }
      }

      // Check if all pairs have met as opponents
      let allOppMet = true;
      for (let i = 0; i < n && allOppMet; i++)
        for (let j = i + 1; j < n && allOppMet; j++)
          if (opp[i][j] === 0) allOppMet = false;
      if (allOppMet) break;
    }

    // Shuffle table positions per round
    rounds.forEach(round => shuffleArray(round.tables));
    return rounds;
  }
```

Also rename the existing non-sit-out logic to `generateScheduleFullField`. Extract the current body (from `function generateCandidate()` through the return) into a new function placed right before `generateSchedule`:

```javascript
  function generateScheduleFullField(players, formats) {
    const n = players.length;
    const maxRounds = 20;

    function generateCandidate() {
      // ... (existing generateCandidate body, unchanged)
    }

    function scoreSchedule(result) {
      // ... (existing scoreSchedule body, unchanged)
    }

    function scoreRounds(rounds) {
      // ... (existing scoreRounds body, unchanged)
    }

    // Try circle method for all-doubles/all-singles (fast path)
    const allDoubles = formats.every(f => f === 4) && n % 2 === 0;
    const allSingles = formats.every(f => f === 2);

    if ((allDoubles && formats.length >= 3) || allSingles) {
      let best = null;
      let bestScore = Infinity;
      for (let a = 0; a < 20; a++) {
        const rounds = circleSchedule(players, formats);
        const score = scoreRounds(rounds);
        if (score < bestScore) { bestScore = score; best = rounds; }
        if (bestScore < 2000) break;
      }
      // Add empty sittingOut to each round for consistency
      if (best) best.forEach(round => { round.sittingOut = round.sittingOut || []; });
      return best;
    }

    // Greedy multi-candidate approach
    const maxAttempts = 40;
    const timeLimit = 15000;
    const startTime = Date.now();
    let best = null;
    let bestScore = Infinity;

    for (let a = 0; a < maxAttempts; a++) {
      const candidate = generateCandidate();
      const score = scoreSchedule(candidate);
      if (score < bestScore) {
        bestScore = score;
        best = candidate.rounds;
      }
      if (bestScore < 2000) break;
      if (Date.now() - startTime > timeLimit) break;
    }

    // Shuffle table positions per round
    if (best) best.forEach(round => {
      shuffleArray(round.tables);
      round.sittingOut = round.sittingOut || [];
    });
    return best;
  }
```

Update the Scheduler export to include the new function:

```javascript
globalThis.Scheduler = { decideTableFormats, assignRound, generateSchedule, generateScheduleFullField, shuffleArray };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: All tests pass — old tests work (backward compat with `allow2v1` default `true`), new sit-out tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/test-scheduler.mjs
git commit -m "feat: generateSchedule supports sit-outs with fair rotation"
```

---

### Task 4: UI — remove min table floor and add 2v1 toggle

**Files:**
- Modify: `index.html:614-701` — state, renderSetup, getSummaryText, changeTableCount
- Modify: `tests/test-ui.sh` — new UI tests, update reset_app

- [ ] **Step 1: Add `allow2v1` to state and update `reset_app` in UI tests**

In `index.html`, add `allow2v1: true` to the state object at line 614:

```javascript
  const state = {
    players: [],
    tableCount: 1,
    rounds: [],
    currentView: 'setup',
    currentRound: 0,
    allow2v1: true
  };
```

In `tests/test-ui.sh`, update the `reset_app` function to include the new state:

```bash
reset_app() {
  agent-browser eval "state.players = []; state.tableCount = 1; state.rounds = []; state.currentView = 'setup'; state.currentRound = 0; state.allow2v1 = true; nextColorIndex = 0; renderSetup();" >/dev/null 2>&1
  agent-browser snapshot >/dev/null 2>&1
}
```

- [ ] **Step 2: Remove min table floor**

In `index.html`, update `renderSetup` — change line 627:

```javascript
    const minTables = 1;
```

Update `changeTableCount` — change line 780:

```javascript
    const minTables = 1;
```

- [ ] **Step 3: Add 2v1 toggle to setup view**

In `renderSetup`, after the tables stepper `</div>` (after line 670), add the toggle checkbox:

```html
        <div class="mb-6">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" ${state.allow2v1 ? 'checked' : ''}
              onchange="toggle2v1()"
              class="w-4 h-4 rounded border-gray-600 bg-gray-700 accent-blue-500">
            <span class="text-sm text-gray-300">Allow 2v1 format</span>
          </label>
        </div>
```

Add the event handler after `editPlayers()`:

```javascript
  function toggle2v1() {
    state.allow2v1 = !state.allow2v1;
    renderSetup();
  }
```

- [ ] **Step 4: Update `getSummaryText` to show sit-out count**

Replace the `getSummaryText` function:

```javascript
  function getSummaryText() {
    const n = state.players.length;
    if (n < 2) return 'Add at least 2 players to generate';
    const formats = decideTableFormats(n, state.tableCount, state.allow2v1);
    const capacity = formats.reduce((a, b) => a + b, 0);
    const sitOuts = n - capacity;
    const types = formats.map(f => f === 4 ? 'doubles' : f === 3 ? '2v1' : 'singles');
    const unique = [...new Set(types)].join(' + ');
    let text = `${n} players × ${formats.length} table${formats.length > 1 ? 's' : ''} → ${unique}`;
    if (sitOuts > 0) text += ` (${sitOuts} sit out per round)`;
    return text;
  }
```

- [ ] **Step 5: Update `generate()` to pass `allow2v1`**

In the `generate` function, update the `generateSchedule` call:

```javascript
      state.rounds = generateSchedule(state.players, state.tableCount, state.allow2v1);
```

- [ ] **Step 6: Run unit and UI tests**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Run: `./tests/test-ui.sh`
Expected: All pass. Existing UI tests should still pass since min table behavior for 4-5 player configs hasn't changed meaningfully (4p still has max 2 tables, 5p now allows 1 table).

**Note:** Some existing UI tests need adjustment because the min table floor changed:

1. **Line 141** (`5 players: min tables is 2, count auto-clamped`): With min=1, the table count is NOT auto-clamped to 2 anymore. Before this test, the table count was incremented to 2 (line 126) then decremented to 1 (line 132). Eve was added with count=1. Count stays at 1 now (no clamping). Update to:
   ```bash
   assert_snapshot_contains "5 players: table count stays at 1, max is 2" '"1 / 2"'
   ```

2. **Line 142** (`both buttons disabled when min=max`): With min=1 and count=1, minus IS disabled (at min=1) but plus is NOT disabled (max=2). Update to:
   ```bash
   assert_snapshot_contains "minus disabled at min=1" 'button "−" [disabled'
   assert_snapshot_not_contains "plus enabled (max=2)" 'button "+" [disabled'
   ```

3. **Line 136** (`- disabled at min (1)`): This test checks minus disabled at 1 — still correct since min is now 1.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/test-ui.sh
git commit -m "feat: remove min table floor, add 2v1 toggle to setup view"
```

---

### Task 5: UI — sit-out display in schedule view

**Files:**
- Modify: `index.html:705-757` — update `renderSchedule`
- Modify: `tests/test-ui.sh` — sit-out display tests

- [ ] **Step 1: Write UI tests for sit-out display**

Add a new section in `tests/test-ui.sh` before `=== Player Management Edge Cases ===`:

```bash
echo ""
echo "=== Sit-out Display Tests ==="

# Setup: 6 players, 1 table (4 play, 2 sit out)
reset_app
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

# Keep table count at 1 (min is now 1)
# With 6p/1t: decideTableFormats returns [4] = doubles, 2 sit out
click_ref e6
# Wait briefly for schedule generation
sleep 1
agent-browser snapshot >/dev/null 2>&1
assert_snapshot_contains "6p/1t: shows Sitting out label" "Sitting out"
assert_snapshot_contains "6p/1t: shows DOUBLES table" "DOUBLES"

# Test: sit-out display shows player pills
# At least 2 player names should appear after "Sitting out"
snapshot=$(agent-browser snapshot 2>&1)
SIT_OUT_COUNT=$(echo "$snapshot" | grep -c "Sitting out")
if [ "$SIT_OUT_COUNT" -ge 1 ]; then
  echo "  PASS: sit-out section present in round cards"
  inc PASS
else
  echo "  FAIL: sit-out section missing (expected >=1, got $SIT_OUT_COUNT)"
  inc FAIL
fi
```

- [ ] **Step 2: Update `renderSchedule` to show sit-out players**

In `index.html`, inside the `renderSchedule` function, after the tables loop (after line 752 `\`).join('')}`), add the sit-out display before the closing `</div>` of each round card:

```javascript
            ${(round.sittingOut && round.sittingOut.length > 0) ? `
              <div class="mt-3 pt-3 border-t border-gray-700">
                <span class="text-xs text-gray-500 uppercase tracking-wider">Sitting out</span>
                <div class="flex flex-wrap gap-1.5 mt-1.5">
                  ${round.sittingOut.map(p => `
                    <span class="pill" style="background: ${PALETTE[p.colorIndex % PALETTE.length]}; font-size: 12px; padding: 2px 8px; opacity: 0.5;">
                      ${escapeHtml(p.name)}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
```

- [ ] **Step 3: Run all tests**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Run: `./tests/test-ui.sh`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add index.html tests/test-ui.sh
git commit -m "feat: show sitting-out players in schedule view"
```

---

### Task 6: UI tests — 2v1 toggle and summary text

**Files:**
- Modify: `tests/test-ui.sh` — toggle tests and summary text tests

- [ ] **Step 1: Add 2v1 toggle UI tests**

Add a new section in `tests/test-ui.sh` after `=== Sit-out Display Tests ===`:

```bash
echo ""
echo "=== 2v1 Toggle Tests ==="

reset_app
fill_ref e2 "A"
click_ref e3
fill_ref e2 "B"
click_ref e3
fill_ref e2 "C"
click_ref e3
fill_ref e2 "D"
click_ref e3
fill_ref e2 "E"
click_ref e3

# 2v1 toggle should be visible and checked by default
assert_snapshot_contains "2v1 toggle visible" "Allow 2v1 format"

# Summary with 5p/2t (default table count for 5 players) should show 2v1
assert_snapshot_contains "5p summary includes 2v1" "2v1"

# Uncheck the 2v1 toggle
TOGGLE_REF=$(agent-browser snapshot 2>&1 | grep "Allow 2v1" | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
click_ref "$TOGGLE_REF"

# Summary should no longer show 2v1, should show sit-out instead
assert_snapshot_not_contains "2v1 off: no 2v1 in summary" "2v1"
assert_snapshot_contains "2v1 off: shows sit-out in summary" "sit out"

# Re-check the toggle
TOGGLE_REF=$(agent-browser snapshot 2>&1 | grep "Allow 2v1" | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
click_ref "$TOGGLE_REF"
assert_snapshot_contains "2v1 re-enabled: summary shows 2v1 again" "2v1"
```

- [ ] **Step 2: Add table stepper min=1 test**

```bash
echo ""
echo "=== Table Min=1 Tests ==="

reset_app
for i in $(seq 1 8); do
  fill_ref e2 "P$i"
  click_ref e3
done

# With 8 players, should be able to go down to 1 table
# Click minus until we reach 1
for i in $(seq 1 10); do
  snapshot=$(agent-browser snapshot 2>&1)
  if echo "$snapshot" | grep -q '"1 / 4"'; then
    break
  fi
  MINUS_REF=$(echo "$snapshot" | grep '"−"' | grep -o 'ref=e[0-9]*' | head -1 | sed 's/ref=//')
  if [ -n "$MINUS_REF" ]; then
    click_ref "$MINUS_REF"
  fi
done
assert_snapshot_contains "8p: can go down to 1 table" '"1 / 4"'
assert_snapshot_contains "8p/1t: summary shows sit-out" "sit out"
```

- [ ] **Step 3: Run all tests**

Run: `./tests/test-ui.sh`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test-ui.sh
git commit -m "test: add UI tests for 2v1 toggle and table min=1"
```

---

### Task 7: Final integration test and cleanup

**Files:**
- Modify: `tests/test-scheduler.mjs` — integration test for allow2v1=false with sit-outs
- Modify: `index.html` — any edge case fixes found during testing

- [ ] **Step 1: Write integration test combining both features**

```javascript
test('allow2v1=false with sit-outs: 7p/2t → [4,2], 1 sits out, no 2v1', (S) => {
  const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = S.generateSchedule(players, 2, false);
  assert.ok(rounds.length > 0);
  for (const round of rounds) {
    // No 2v1 tables
    for (const t of round.tables) {
      assert.notStrictEqual(t.format, '2v1', 'no 2v1 tables when allow2v1=false');
    }
    // 1 sitting out (7 - 6 = 1)
    assert.strictEqual(round.sittingOut.length, 1);
    // All players accounted for
    const active = new Set();
    for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) active.add(p.name);
    assert.strictEqual(active.size + round.sittingOut.length, 7);
  }
});

test('allow2v1=false: all existing configs still produce valid schedules', (S) => {
  for (let n = 2; n <= 14; n++) {
    const maxT = Math.floor(n / 2);
    for (let t = 1; t <= Math.min(maxT, 5); t++) {
      const players = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
      const rounds = S.generateSchedule(players, t, false);
      assert.ok(rounds.length > 0, `${n}p/${t}t allow2v1=false: should produce rounds`);
      for (const round of rounds) {
        for (const table of round.tables) {
          assert.notStrictEqual(table.format, '2v1', `${n}p/${t}t: no 2v1 when disabled`);
        }
        const active = new Set();
        for (const table of round.tables)
          for (const p of [...table.sideA, ...table.sideB]) active.add(p.name);
        const sitOut = round.sittingOut ? round.sittingOut.length : 0;
        assert.strictEqual(active.size + sitOut, n, `${n}p/${t}t: all players accounted for`);
      }
    }
  }
});
```

- [ ] **Step 2: Run all tests**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Run: `./tests/test-ui.sh`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add tests/test-scheduler.mjs index.html
git commit -m "test: add integration tests for allow2v1=false with sit-outs"
```

---

## Verification

1. **Unit tests:** `/opt/homebrew/bin/node tests/test-scheduler.mjs` — all pass
2. **UI tests:** `./tests/test-ui.sh` — all pass
3. **Manual check with agent-browser:**
   - Open app, add 8 players, set 1 table → summary shows "4 sit out per round"
   - Generate → each round card shows "Sitting out" with 2 greyed-out pills
   - Add 5 players, uncheck "Allow 2v1" → summary shows "1 sit out per round" instead of 2v1
   - Check toggle back on → 2v1 returns
4. **Existing functionality preserved:** 4p/1t (doubles, no sit-outs), 6p/3t (all singles), 12p/3t (circle method) all still work correctly
