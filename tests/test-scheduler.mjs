import assert from 'node:assert';
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

// --- min tables constraint: ceil(playerCount / 4) ---

test('5 players need at least 2 tables (max 4 per table)', () => {
  const minTables = Math.ceil(5 / 4); // 2
  const formats = Scheduler.decideTableFormats(5, minTables);
  assert.strictEqual(formats.reduce((a, b) => a + b, 0), 5);
  assert.ok(formats.every(f => f <= 4), 'no table should exceed 4 players');
});

test('9 players need at least 3 tables', () => {
  const minTables = Math.ceil(9 / 4); // 3
  const formats = Scheduler.decideTableFormats(9, minTables);
  assert.strictEqual(formats.reduce((a, b) => a + b, 0), 9);
  assert.ok(formats.every(f => f <= 4), 'no table should exceed 4 players');
});

test('decideTableFormats: no table exceeds 4 players for 2-20 players', () => {
  for (let n = 2; n <= 20; n++) {
    const minTables = Math.ceil(n / 4);
    const maxTables = Math.floor(n / 2);
    for (let t = minTables; t <= maxTables; t++) {
      const formats = Scheduler.decideTableFormats(n, t);
      const total = formats.reduce((a, b) => a + b, 0);
      assert.strictEqual(total, n, `${n} players, ${t} tables: total should be ${n}, got ${total}`);
      assert.ok(formats.every(f => f >= 2 && f <= 4), `${n} players, ${t} tables: all formats should be 2-4`);
    }
  }
});

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

  const n = 6;
  const met = Array.from({ length: n }, () => Array(n).fill(false));
  for (const round of rounds) {
    for (const table of round.tables) {
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

run();
