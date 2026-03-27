# Shuffle Pong Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page table tennis group scheduler that generates rotating rounds with maximum opponent variety.

**Architecture:** Single HTML file with embedded JS. Scheduler logic is separated into pure functions (exported via globalThis for testability). Two-view UI rendered with vanilla JS DOM manipulation. Tailwind CSS via CDN for styling.

**Tech Stack:** Vanilla JS, Tailwind CSS (CDN), Node.js for tests (assert module)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `.gitignore`
- Create: `CLAUDE.md`
- Create: `README.md`

- [ ] **Step 1: Initialise git repo**

Run: `git init`

- [ ] **Step 2: Create .gitignore**

```
.superpowers/
.DS_Store
```

- [ ] **Step 3: Create CLAUDE.md**

```markdown
# Shuffle Pong

Single-page table tennis group scheduler. Single HTML file, Tailwind via CDN, vanilla JS.

## Run

Open `index.html` in a browser, or serve with any static server.

## Test

```bash
/opt/homebrew/bin/node tests/test-scheduler.mjs
```

## Deploy

GitHub Pages from main branch. Push to main to deploy.

## Architecture

- `index.html` — the complete app (HTML + CSS + JS)
- `tests/test-scheduler.mjs` — unit tests for scheduler algorithm
- Scheduler functions are exposed on `globalThis.Scheduler` for testability
```

- [ ] **Step 4: Create README.md**

```markdown
# Shuffle Pong

Table tennis group scheduler. Generates rotating rounds so everyone plays as many different opponents as possible.

Enter player names, set table count, generate a full schedule. Supports singles (1v1), doubles (2v2), and 2v1 formats with no sit-outs.

Single HTML file — [open it on GitHub Pages](https://USERNAME.github.io/shuffle-pong/).
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore CLAUDE.md README.md
git commit -m "chore: project scaffolding"
```

---

### Task 2: Table Format Assignment — Tests

**Files:**
- Create: `tests/test-scheduler.mjs`

- [ ] **Step 1: Create test file with decideTableFormats tests**

```js
import assert from 'node:assert';

// Import scheduler from globalThis (loaded via dynamic import of a wrapper)
// For now, we define the tests — the functions will be imported in Task 4.

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// --- decideTableFormats tests ---

test('2 players, 1 table → 1× singles', () => {
  const formats = Scheduler.decideTableFormats(2, 1);
  assert.deepStrictEqual(formats, [2]);
});

test('3 players, 1 table → 1× 2v1', () => {
  const formats = Scheduler.decideTableFormats(3, 1);
  assert.deepStrictEqual(formats, [3]);
});

test('4 players, 1 table → 1× doubles', () => {
  const formats = Scheduler.decideTableFormats(4, 1);
  assert.deepStrictEqual(formats, [4]);
});

test('4 players, 2 tables → 1× doubles (uses fewer tables)', () => {
  const formats = Scheduler.decideTableFormats(4, 2);
  assert.deepStrictEqual(formats, [4]);
});

test('5 players, 2 tables → 1× 2v1 + 1× singles', () => {
  const formats = Scheduler.decideTableFormats(5, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [3, 2]);
});

test('6 players, 2 tables → 1× doubles + 1× singles', () => {
  const formats = Scheduler.decideTableFormats(6, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 2]);
});

test('7 players, 2 tables → 1× doubles + 1× 2v1', () => {
  const formats = Scheduler.decideTableFormats(7, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 3]);
});

test('8 players, 2 tables → 2× doubles', () => {
  const formats = Scheduler.decideTableFormats(8, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
});

test('7 players, 3 tables → uses only 2 tables', () => {
  const formats = Scheduler.decideTableFormats(7, 3);
  assert.strictEqual(formats.length, 2);
  assert.strictEqual(formats.reduce((a, b) => a + b, 0), 7);
});

// --- Runner ---

async function run() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  PASS: ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${t.name}`);
      console.log(`        ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

// The Scheduler global will be loaded before run() is called.
// See Task 4 for the import mechanism.
export { run, tests };
```

- [ ] **Step 2: Commit**

```bash
git add tests/test-scheduler.mjs
git commit -m "test: add decideTableFormats test cases"
```

---

### Task 3: Table Format Assignment — Implementation

**Files:**
- Create: `index.html` (initial version with just the scheduler module)

- [ ] **Step 1: Create index.html with scheduler functions**

Create `index.html` with the scheduler logic in a `<script>` tag. The functions are exposed on `globalThis.Scheduler` for testability.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shuffle Pong</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen" style="background: #1a1a2e;">
  <div id="app"></div>
  <script>
  // ===== Scheduler Module =====

  const PALETTE = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#f1c40f',
    '#8e44ad', '#16a085', '#d35400', '#c0392b', '#2c3e50',
    '#7f8c8d', '#d4ac0d', '#1a5276', '#a93226', '#117a65'
  ];

  /**
   * Decide table formats for N players across at most T tables.
   * Returns an array of player counts per table (2, 3, or 4).
   * Prefers doubles (4) and singles (2). Uses 2v1 (3) only for odd remainders.
   */
  function decideTableFormats(playerCount, tableCount) {
    // How many tables can we actually fill?
    const maxTables = Math.min(tableCount, Math.floor(playerCount / 2));

    // Try to fill with doubles (4) first, then handle remainder.
    // With T tables, max capacity = 4*T. Min capacity = 2*T.
    // We need to seat exactly playerCount.

    // Start: fill as many doubles as possible
    let best = null;

    for (let numTables = 1; numTables <= maxTables; numTables++) {
      // With numTables tables, try different numbers of doubles
      for (let d = numTables; d >= 0; d--) {
        // d doubles tables, remaining are singles or 2v1
        const remaining = numTables - d;
        const doublesPlayers = d * 4;
        const leftover = playerCount - doublesPlayers;

        if (leftover < 0) continue;
        if (remaining === 0 && leftover === 0) {
          // All doubles, perfect fit
          return Array(d).fill(4);
        }
        if (remaining === 0) continue;

        // Distribute leftover across remaining tables (each gets 2 or 3)
        // leftover = remaining * 2 + x, where x tables get bumped to 3
        const base = remaining * 2;
        const extra = leftover - base;

        if (extra < 0) continue;
        if (extra > remaining) continue; // can't bump more tables than we have

        // extra tables get 3 players, rest get 2
        const formats = Array(d).fill(4);
        for (let i = 0; i < extra; i++) formats.push(3);
        for (let i = 0; i < remaining - extra; i++) formats.push(2);

        // Prefer: fewest 2v1 tables, then fewest total tables
        if (!best || extra < best.threes || (extra === best.threes && formats.length < best.formats.length)) {
          best = { formats, threes: extra };
        }
      }
    }

    return best ? best.formats : [];
  }

  // Expose for testing
  if (typeof globalThis !== 'undefined') {
    globalThis.Scheduler = { decideTableFormats };
  }

  </script>
</body>
</html>
```

- [ ] **Step 2: Add test runner wrapper to test file**

Update `tests/test-scheduler.mjs` to load the scheduler functions from `index.html` by extracting the script content:

```js
// Add at the top of tests/test-scheduler.mjs, before the tests:
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf-8');

// Extract the script content from index.html
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!scriptMatch) throw new Error('Could not find scheduler script in index.html');

// Execute the script to populate globalThis.Scheduler
new Function(scriptMatch[1])();
const Scheduler = globalThis.Scheduler;
```

Remove the `export { run, tests }` line and instead call `run()` directly at the end:

```js
// At the bottom of the file, replace the export with:
run();
```

- [ ] **Step 3: Run tests**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: All 9 decideTableFormats tests PASS.

- [ ] **Step 4: Commit**

```bash
git add index.html tests/test-scheduler.mjs
git commit -m "feat: implement decideTableFormats with passing tests"
```

---

### Task 4: Round Assignment — Tests

**Files:**
- Modify: `tests/test-scheduler.mjs`

- [ ] **Step 1: Add assignRound and generateSchedule tests**

Add these tests after the existing decideTableFormats tests:

```js
// --- assignRound tests ---

test('assignRound with 2 players produces valid singles match', () => {
  const players = [
    { name: 'A', colorIndex: 0 },
    { name: 'B', colorIndex: 1 }
  ];
  const opponentMatrix = [[0, 0], [0, 0]];
  const partnerMatrix = [[0, 0], [0, 0]];
  const round = Scheduler.assignRound(players, [2], opponentMatrix, partnerMatrix);

  assert.strictEqual(round.tables.length, 1);
  assert.strictEqual(round.tables[0].format, 'singles');
  assert.strictEqual(round.tables[0].sideA.length, 1);
  assert.strictEqual(round.tables[0].sideB.length, 1);
});

test('assignRound with 3 players produces 2v1', () => {
  const players = [
    { name: 'A', colorIndex: 0 },
    { name: 'B', colorIndex: 1 },
    { name: 'C', colorIndex: 2 }
  ];
  const n = 3;
  const opponentMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const partnerMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const round = Scheduler.assignRound(players, [3], opponentMatrix, partnerMatrix);

  assert.strictEqual(round.tables.length, 1);
  assert.strictEqual(round.tables[0].format, '2v1');
  const total = round.tables[0].sideA.length + round.tables[0].sideB.length;
  assert.strictEqual(total, 3);
});

// --- generateSchedule tests ---

test('generateSchedule: no sit-outs (every round uses all players)', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 2);

  for (const round of rounds) {
    const playerNames = new Set();
    for (const table of round.tables) {
      for (const p of [...table.sideA, ...table.sideB]) {
        playerNames.add(p.name);
      }
    }
    assert.strictEqual(playerNames.size, 6, `Round should have all 6 players, got ${playerNames.size}`);
  }
});

test('generateSchedule: opponent variety (6 players, every pair meets)', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 2);

  // Build opponent matrix from results
  const n = 6;
  const met = Array.from({ length: n }, () => Array(n).fill(false));
  for (const round of rounds) {
    for (const table of round.tables) {
      // Everyone on sideA is opponent of everyone on sideB
      for (const a of table.sideA) {
        for (const b of table.sideB) {
          const ai = players.indexOf(a);
          const bi = players.indexOf(b);
          met[ai][bi] = true;
          met[bi][ai] = true;
        }
      }
    }
  }

  // Check every pair has met
  let allMet = true;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!met[i][j]) allMet = false;
    }
  }
  assert.ok(allMet, 'Not all player pairs have been opponents');
});

test('generateSchedule: 2 players produces exactly 1 round', () => {
  const players = [
    { name: 'A', colorIndex: 0 },
    { name: 'B', colorIndex: 1 }
  ];
  const rounds = Scheduler.generateSchedule(players, 1);
  assert.strictEqual(rounds.length, 1);
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: The new assignRound and generateSchedule tests FAIL (functions not yet defined). The decideTableFormats tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test-scheduler.mjs
git commit -m "test: add assignRound and generateSchedule test cases"
```

---

### Task 5: Round Assignment — Implementation

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add assignRound function**

Add after `decideTableFormats` in the `<script>` tag:

```js
/**
 * Get all combinations of `k` items from `arr`.
 */
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/**
 * Score how "costly" it is for groupA to face groupB, based on opponent history.
 * Lower is better. Returns the max opponent count among all cross-pairs.
 */
function opponentCost(groupA, groupB, players, opponentMatrix) {
  let maxCount = 0;
  for (const a of groupA) {
    for (const b of groupB) {
      const ai = players.indexOf(a);
      const bi = players.indexOf(b);
      maxCount = Math.max(maxCount, opponentMatrix[ai][bi]);
    }
  }
  return maxCount;
}

/**
 * Score partner cost for a group being on the same side. Lower is better.
 */
function partnerCost(group, players, partnerMatrix) {
  let maxCount = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const ai = players.indexOf(group[i]);
      const bi = players.indexOf(group[j]);
      maxCount = Math.max(maxCount, partnerMatrix[ai][bi]);
    }
  }
  return maxCount;
}

/**
 * For a given set of players at a table, find the best side split.
 * format: 2 (1v1), 3 (2v1), 4 (2v2)
 * Returns { sideA, sideB, oppCost, partCost }
 */
function bestSplit(group, format, players, opponentMatrix, partnerMatrix) {
  const sideASize = format === 2 ? 1 : 2;
  const splits = combinations(group, sideASize);
  let best = null;

  for (const sideA of splits) {
    const sideB = group.filter(p => !sideA.includes(p));
    const oc = opponentCost(sideA, sideB, players, opponentMatrix);
    const pcA = partnerCost(sideA, players, partnerMatrix);
    const pcB = partnerCost(sideB, players, partnerMatrix);
    const pc = Math.max(pcA, pcB);

    if (!best || oc < best.oppCost || (oc === best.oppCost && pc < best.partCost)) {
      best = { sideA, sideB, oppCost: oc, partCost: pc };
    }
  }
  return best;
}

/**
 * Assign one round of play.
 * players: full player array (for index lookups)
 * formats: array from decideTableFormats (e.g. [4, 2])
 * Returns a Round: { tables: Table[] }
 */
function assignRound(players, formats, opponentMatrix, partnerMatrix) {
  // Sort formats descending (assign biggest tables first)
  const sortedFormats = [...formats].sort((a, b) => b - a);
  const pool = [...players];
  const tables = [];

  for (const format of sortedFormats) {
    // Try all combinations of `format` players from the pool
    const candidates = combinations(pool, format);
    let bestTable = null;

    for (const group of candidates) {
      const split = bestSplit(group, format, players, opponentMatrix, partnerMatrix);
      if (!bestTable || split.oppCost < bestTable.oppCost ||
          (split.oppCost === bestTable.oppCost && split.partCost < bestTable.partCost)) {
        bestTable = { ...split, format };
      }
    }

    const formatLabel = format === 4 ? 'doubles' : format === 3 ? '2v1' : 'singles';
    tables.push({
      format: formatLabel,
      sideA: bestTable.sideA,
      sideB: bestTable.sideB
    });

    // Remove assigned players from pool
    for (const p of [...bestTable.sideA, ...bestTable.sideB]) {
      pool.splice(pool.indexOf(p), 1);
    }
  }

  return { tables };
}
```

- [ ] **Step 2: Add generateSchedule function**

Add after `assignRound`:

```js
/**
 * Generate a full schedule of rounds.
 * Keeps generating until every pair has been opponents at least once,
 * or until hitting a cap of 20 rounds.
 */
function generateSchedule(players, tableCount) {
  const n = players.length;
  const opponentMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const partnerMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const rounds = [];
  const maxRounds = 20;

  while (rounds.length < maxRounds) {
    const formats = decideTableFormats(n, tableCount);
    const round = assignRound(players, formats, opponentMatrix, partnerMatrix);
    rounds.push(round);

    // Update matrices
    for (const table of round.tables) {
      // Opponents: sideA vs sideB
      for (const a of table.sideA) {
        for (const b of table.sideB) {
          const ai = players.indexOf(a);
          const bi = players.indexOf(b);
          opponentMatrix[ai][bi]++;
          opponentMatrix[bi][ai]++;
        }
      }
      // Partners: same side
      const sides = [table.sideA, table.sideB];
      for (const side of sides) {
        for (let i = 0; i < side.length; i++) {
          for (let j = i + 1; j < side.length; j++) {
            const ai = players.indexOf(side[i]);
            const bi = players.indexOf(side[j]);
            partnerMatrix[ai][bi]++;
            partnerMatrix[bi][ai]++;
          }
        }
      }
    }

    // Check if all pairs have been opponents
    let allMet = true;
    for (let i = 0; i < n && allMet; i++) {
      for (let j = i + 1; j < n && allMet; j++) {
        if (opponentMatrix[i][j] === 0) allMet = false;
      }
    }
    if (allMet) break;
  }

  return rounds;
}
```

- [ ] **Step 3: Update globalThis.Scheduler export**

```js
if (typeof globalThis !== 'undefined') {
  globalThis.Scheduler = { decideTableFormats, assignRound, generateSchedule };
}
```

- [ ] **Step 4: Run all tests**

Run: `/opt/homebrew/bin/node tests/test-scheduler.mjs`
Expected: All 15 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: implement assignRound and generateSchedule"
```

---

### Task 6: Setup View UI

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add custom styles**

Add a `<style>` block after the Tailwind script in `<head>`:

```html
<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    color: white;
    cursor: default;
  }
  .pill button {
    background: none;
    border: none;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    font-size: 14px;
    padding: 0 0 0 4px;
    line-height: 1;
  }
  .pill button:hover {
    color: white;
  }
  .card {
    background: #16213e;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
  }
</style>
```

- [ ] **Step 2: Add app state and render functions**

Add after the Scheduler functions in the `<script>` tag:

```js
// ===== App State =====

const state = {
  players: [],
  tableCount: 1,
  rounds: [],
  currentView: 'setup' // 'setup' | 'schedule'
};

// ===== Render: Setup View =====

function renderSetup() {
  const app = document.getElementById('app');
  const maxTables = Math.max(1, Math.floor(state.players.length / 2));
  if (state.tableCount > maxTables) state.tableCount = maxTables;

  app.innerHTML = `
    <div class="max-w-lg mx-auto px-4 py-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-white">Shuffle Pong</h1>
        <p class="text-gray-500 text-sm">Table Tennis Group Scheduler</p>
      </div>

      <div class="mb-6">
        <label class="block text-xs text-gray-400 uppercase tracking-wider mb-2">Players</label>
        <div id="player-pills" class="flex flex-wrap gap-2 mb-3">
          ${state.players.map((p, i) => `
            <span class="pill" style="background: ${PALETTE[p.colorIndex % 20]}">
              ${escapeHtml(p.name)}
              <button onclick="removePlayer(${i})" title="Remove">&times;</button>
            </span>
          `).join('')}
        </div>
        <div class="flex gap-2">
          <input id="player-input" type="text" placeholder="Add player name..."
            class="flex-1 px-3 py-2 rounded-lg border border-gray-700 text-white text-sm focus:outline-none focus:border-blue-500"
            style="background: #16213e;"
            onkeydown="if(event.key==='Enter')addPlayer()">
          <button onclick="addPlayer()"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500">Add</button>
        </div>
        <p class="text-gray-600 text-xs mt-1">Press Enter to add, click &times; to remove</p>
      </div>

      <div class="mb-6">
        <label class="block text-xs text-gray-400 uppercase tracking-wider mb-2">Tables Available</label>
        <div class="flex items-center gap-4">
          <button onclick="changeTableCount(-1)"
            class="w-9 h-9 rounded-lg border border-gray-700 text-white text-lg hover:bg-gray-700"
            style="background: #16213e;">−</button>
          <span class="text-2xl font-bold text-white min-w-[40px] text-center">${state.tableCount}</span>
          <button onclick="changeTableCount(1)"
            class="w-9 h-9 rounded-lg border border-gray-700 text-white text-lg hover:bg-gray-700"
            style="background: #16213e;">+</button>
        </div>
      </div>

      <button onclick="generate()" ${state.players.length < 2 ? 'disabled' : ''}
        class="w-full py-3 rounded-xl text-white font-bold text-base ${state.players.length < 2 ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}"
        style="background: linear-gradient(135deg, #3498db, #2ecc71);">
        Generate Schedule →
      </button>

      <p class="text-center text-gray-600 text-xs mt-2">${getSummaryText()}</p>
    </div>
  `;

  document.getElementById('player-input')?.focus();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getSummaryText() {
  const n = state.players.length;
  if (n < 2) return 'Add at least 2 players to generate';
  const formats = decideTableFormats(n, state.tableCount);
  const types = formats.map(f => f === 4 ? 'doubles' : f === 3 ? '2v1' : 'singles');
  const unique = [...new Set(types)].join(' + ');
  return `${n} players × ${formats.length} table${formats.length > 1 ? 's' : ''} → ${unique}`;
}

// ===== Event Handlers =====

function addPlayer() {
  const input = document.getElementById('player-input');
  const name = input.value.trim();
  if (!name) return;
  if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
  state.players.push({ name, colorIndex: state.players.length });
  renderSetup();
}

function removePlayer(index) {
  state.players.splice(index, 1);
  renderSetup();
}

function changeTableCount(delta) {
  const maxTables = Math.max(1, Math.floor(state.players.length / 2));
  state.tableCount = Math.max(1, Math.min(maxTables, state.tableCount + delta));
  renderSetup();
}

function generate() {
  if (state.players.length < 2) return;
  state.rounds = generateSchedule(state.players, state.tableCount);
  state.currentView = 'schedule';
  renderSchedule();
}

function editPlayers() {
  state.currentView = 'setup';
  state.rounds = [];
  renderSetup();
}

// ===== Init =====

renderSetup();
```

- [ ] **Step 3: Test manually in browser**

Open `index.html` in a browser. Verify:
- Dark theme renders correctly.
- Can add players with Enter key and Add button.
- Player pills appear with colours.
- Can remove players with × button.
- Table count stepper works, capped correctly.
- Generate button disabled when < 2 players.
- Summary text updates as players/tables change.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: implement setup view UI"
```

---

### Task 7: Schedule View UI

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add renderSchedule function**

Add the `renderSchedule` function before the `// ===== Init =====` comment:

```js
// ===== Render: Schedule View =====

function renderSchedule() {
  const app = document.getElementById('app');
  const roundCount = state.rounds.length;

  app.innerHTML = `
    <div class="max-w-lg mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-xl font-bold text-white">Shuffle Pong</h1>
        <button onclick="editPlayers()"
          class="px-3 py-1.5 rounded-lg border border-gray-700 text-blue-400 text-sm hover:bg-gray-800"
          style="background: #16213e;">← Edit Players</button>
      </div>

      <p class="text-gray-500 text-sm mb-4">
        ${state.players.length} players · ${state.rounds[0]?.tables.length || 0} table${(state.rounds[0]?.tables.length || 0) > 1 ? 's' : ''} · ${roundCount} round${roundCount > 1 ? 's' : ''} · Repeats from round 1 after completion
      </p>

      ${state.rounds.map((round, ri) => `
        <div class="card" style="border-left: 3px solid ${ri === 0 ? '#3498db' : '#333'};">
          <div class="text-sm font-bold mb-3" style="color: ${ri === 0 ? '#3498db' : '#aaa'};">
            Round ${ri + 1}
          </div>
          ${round.tables.map((table, ti) => `
            <div class="${ti < round.tables.length - 1 ? 'mb-3' : ''}">
              <div class="text-xs text-gray-600 uppercase tracking-wider mb-1.5">
                Table ${ti + 1} · ${table.format === 'singles' ? 'Singles' : table.format === 'doubles' ? 'Doubles' : '2v1'}
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                ${table.sideA.map(p => `
                  <span class="pill" style="background: ${PALETTE[p.colorIndex % 20]}; font-size: 13px; padding: 2px 10px;">
                    ${escapeHtml(p.name)}
                  </span>
                `).join('')}
                <span class="text-gray-600 font-bold text-sm">vs</span>
                ${table.sideB.map(p => `
                  <span class="pill" style="background: ${PALETTE[p.colorIndex % 20]}; font-size: 13px; padding: 2px 10px;">
                    ${escapeHtml(p.name)}
                  </span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
}
```

- [ ] **Step 2: Test manually in browser**

Open `index.html` in a browser. Add 6 players, set 2 tables, click Generate. Verify:
- Schedule view renders with all rounds.
- Each round card shows table matchups with format labels.
- Player pills have correct colours matching setup view.
- "vs" separator between sides.
- "Edit Players" button returns to setup with players preserved.
- Summary line shows correct counts.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: implement schedule view UI"
```

---

### Task 8: GitHub Setup & Deploy

**Files:**
- No new files

- [ ] **Step 1: Create GitHub repo**

Run: `gh repo create shuffle-pong --public --source=. --push`

- [ ] **Step 2: Enable GitHub Pages**

Run: `gh api repos/{owner}/shuffle-pong/pages -X POST -f build_type=workflow -f source.branch=main -f source.path=/`

If that fails (Pages API can be finicky), use:
Run: `gh browse --settings` and enable Pages manually from Settings > Pages > Deploy from branch: main, folder: / (root).

Alternatively, since this is a simple static site, GitHub Pages with "deploy from branch" should serve `index.html` from root automatically.

- [ ] **Step 3: Verify deployment**

Run: `gh repo view --web` to open the repo, then check the Pages URL (typically `https://USERNAME.github.io/shuffle-pong/`).

- [ ] **Step 4: Update README with actual Pages URL**

Replace the placeholder URL in `README.md` with the actual GitHub Pages URL.

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs: add GitHub Pages URL to README"
git push
```
