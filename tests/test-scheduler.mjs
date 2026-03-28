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

test('4 players, 2 tables → 2× singles (prefers more tables)', () => {
  const formats = Scheduler.decideTableFormats(4, 2);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [2, 2]);
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

test('7 players, 3 tables → uses all 3 tables (2v1 + singles + singles)', () => {
  const formats = Scheduler.decideTableFormats(7, 3);
  assert.strictEqual(formats.length, 3);
  assert.strictEqual(formats.reduce((a, b) => a + b, 0), 7);
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [3, 2, 2]);
});

test('6 players, 3 tables → uses all 3 tables (3× singles)', () => {
  const formats = Scheduler.decideTableFormats(6, 3);
  assert.strictEqual(formats.length, 3);
  assert.deepStrictEqual(formats, [2, 2, 2]);
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

test('generateSchedule: no repeated partnerships when format allows (8p, 3 tables)', () => {
  const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 3);
  const n = 8;
  const partnerCount = Array.from({ length: n }, () => Array(n).fill(0));

  for (const round of rounds) {
    for (const table of round.tables) {
      for (const side of [table.sideA, table.sideB]) {
        for (let i = 0; i < side.length; i++) {
          for (let j = i + 1; j < side.length; j++) {
            const ai = players.indexOf(side[i]);
            const bi = players.indexOf(side[j]);
            partnerCount[ai][bi]++;
            partnerCount[bi][ai]++;
          }
        }
      }
    }
  }

  let maxPartner = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      maxPartner = Math.max(maxPartner, partnerCount[i][j]);
    }
  }
  assert.ok(maxPartner <= 1, `Max partner repeat should be ≤1, got ${maxPartner}`);
});

test('generateSchedule: 4 players, 1 table — no repeated partnerships', () => {
  const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 1);
  const n = 4;
  const partnerCount = Array.from({ length: n }, () => Array(n).fill(0));

  for (const round of rounds) {
    for (const table of round.tables) {
      for (const side of [table.sideA, table.sideB]) {
        for (let i = 0; i < side.length; i++) {
          for (let j = i + 1; j < side.length; j++) {
            const ai = players.indexOf(side[i]);
            const bi = players.indexOf(side[j]);
            partnerCount[ai][bi]++;
            partnerCount[bi][ai]++;
          }
        }
      }
    }
  }

  let maxPartner = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      maxPartner = Math.max(maxPartner, partnerCount[i][j]);
    }
  }
  assert.ok(maxPartner <= 1, `Max partner repeat should be ≤1, got ${maxPartner}`);
});

test('generateSchedule: 2 players produces exactly 1 round', () => {
  const players = [
    { name: 'A', colorIndex: 0 },
    { name: 'B', colorIndex: 1 }
  ];
  const rounds = Scheduler.generateSchedule(players, 1);
  assert.strictEqual(rounds.length, 1);
});

// --- Schedule quality for ALL common configs (2-14 players, 1-5 tables) ---
// Generate once per config and check all properties in one test to avoid
// redundant schedule generation (which is expensive for larger player counts).

for (let n = 2; n <= 14; n++) {
  const minTables = Math.ceil(n / 4);
  const maxTables = Math.floor(n / 2);
  for (let t = minTables; t <= Math.min(maxTables, 5); t++) {
    const formats = Scheduler.decideTableFormats(n, t);
    const hasTeams = formats.some(f => f >= 3);

    test(`schedule quality: ${n}p/${t}t — sit-outs, table size, opponents${hasTeams ? ', partnerships' : ''}`, () => {
      const players = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
      const rounds = Scheduler.generateSchedule(players, t);
      assert.ok(rounds.length > 0, 'should generate at least 1 round');

      // No sit-outs + no table exceeds 4 players
      for (let ri = 0; ri < rounds.length; ri++) {
        const names = new Set();
        for (let ti = 0; ti < rounds[ri].tables.length; ti++) {
          const table = rounds[ri].tables[ti];
          const count = table.sideA.length + table.sideB.length;
          assert.ok(count <= 4,
            `Round ${ri + 1}, Table ${ti + 1}: ${count} players exceeds max 4`);
          for (const p of [...table.sideA, ...table.sideB]) {
            names.add(p.name);
          }
        }
        assert.strictEqual(names.size, n,
          `Round ${ri + 1}: expected ${n} players, got ${names.size}`);
      }

      // All opponent pairs covered
      const met = Array.from({ length: n }, () => Array(n).fill(false));
      const partnerCount = Array.from({ length: n }, () => Array(n).fill(0));
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
          // Track partnerships
          for (const side of [table.sideA, table.sideB]) {
            for (let i = 0; i < side.length; i++) {
              for (let j = i + 1; j < side.length; j++) {
                const ai = players.indexOf(side[i]);
                const bi = players.indexOf(side[j]);
                partnerCount[ai][bi]++;
                partnerCount[bi][ai]++;
              }
            }
          }
        }
      }
      let unmetPairs = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (!met[i][j]) unmetPairs++;
        }
      }
      // All-doubles via circle method (e.g. 12p/3t) may leave ≤2 pairs unmet;
      // all other configs should achieve full opponent coverage.
      const allDoubles = formats.every(f => f === 4);
      const maxUnmet = (allDoubles && formats.length >= 3) ? 2 : 0;
      assert.ok(unmetPairs <= maxUnmet,
        `${unmetPairs} opponent pairs never met (max allowed: ${maxUnmet})`);

      // No repeated partnerships (only for configs with doubles/2v1)
      if (hasTeams) {
        let maxPartner = 0;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            maxPartner = Math.max(maxPartner, partnerCount[i][j]);
          }
        }
        assert.ok(maxPartner <= 1,
          `Max partner repeat should be ≤1, got ${maxPartner}`);
      }
    });
  }
}

// --- Specific edge cases ---

test('edge case: 3 players, 1 table — 2v1 format, all 3 play', () => {
  const players = Array.from({ length: 3 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 1);
  assert.ok(rounds.length > 0, 'should generate at least 1 round');
  for (const round of rounds) {
    assert.strictEqual(round.tables.length, 1);
    const table = round.tables[0];
    assert.strictEqual(table.format, '2v1');
    const total = table.sideA.length + table.sideB.length;
    assert.strictEqual(total, 3, 'all 3 players should be assigned');
  }
});

test('edge case: 5 players, 2 tables — 2v1 + singles, no sit-outs', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 2);
  assert.ok(rounds.length > 0);
  for (const round of rounds) {
    assert.strictEqual(round.tables.length, 2);
    const formats = round.tables.map(t => t.format).sort();
    assert.deepStrictEqual(formats, ['2v1', 'singles']);
    const names = new Set();
    for (const t of round.tables) {
      for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
    }
    assert.strictEqual(names.size, 5, 'all 5 players should be assigned');
  }
});

test('edge case: 7 players, 3 tables — 2v1 + 2 singles, uses all 3 tables', () => {
  const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 3);
  assert.ok(rounds.length > 0);
  for (const round of rounds) {
    assert.strictEqual(round.tables.length, 3, 'should use all 3 tables');
    const formats = round.tables.map(t => t.format).sort();
    assert.deepStrictEqual(formats, ['2v1', 'singles', 'singles']);
    const names = new Set();
    for (const t of round.tables) {
      for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
    }
    assert.strictEqual(names.size, 7, 'all 7 players should be assigned');
  }
});

test('edge case: 12 players, 3 tables — all-doubles (2v2), circle method, unique partnerships', () => {
  const players = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 3);
  assert.ok(rounds.length > 0);
  // Check all tables have 2v2 structure (4 players: 2 per side)
  for (const round of rounds) {
    assert.strictEqual(round.tables.length, 3);
    for (const table of round.tables) {
      assert.strictEqual(table.sideA.length, 2,
        'all tables should have 2 players on side A for 12p/3t');
      assert.strictEqual(table.sideB.length, 2,
        'all tables should have 2 players on side B for 12p/3t');
    }
  }
  // Check unique partnerships
  const n = 12;
  const partnerCount = Array.from({ length: n }, () => Array(n).fill(0));
  for (const round of rounds) {
    for (const table of round.tables) {
      for (const side of [table.sideA, table.sideB]) {
        for (let i = 0; i < side.length; i++) {
          for (let j = i + 1; j < side.length; j++) {
            const ai = players.indexOf(side[i]);
            const bi = players.indexOf(side[j]);
            partnerCount[ai][bi]++;
            partnerCount[bi][ai]++;
          }
        }
      }
    }
  }
  let maxPartner = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      maxPartner = Math.max(maxPartner, partnerCount[i][j]);
    }
  }
  assert.ok(maxPartner <= 1,
    `12p/3t: max partner repeat should be ≤1, got ${maxPartner}`);
});

test('edge case: 14 players, 4 tables — mixed format, unique partnerships within time limit', () => {
  const players = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const start = Date.now();
  const rounds = Scheduler.generateSchedule(players, 4);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 30000, `Should complete within 30s, took ${elapsed}ms`);
  assert.ok(rounds.length > 0);
  // Check no sit-outs
  for (let ri = 0; ri < rounds.length; ri++) {
    const names = new Set();
    for (const t of rounds[ri].tables) {
      for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
    }
    assert.strictEqual(names.size, 14,
      `Round ${ri + 1}: expected 14 players, got ${names.size}`);
  }
  // Check unique partnerships
  const n = 14;
  const partnerCount = Array.from({ length: n }, () => Array(n).fill(0));
  for (const round of rounds) {
    for (const table of round.tables) {
      for (const side of [table.sideA, table.sideB]) {
        for (let i = 0; i < side.length; i++) {
          for (let j = i + 1; j < side.length; j++) {
            const ai = players.indexOf(side[i]);
            const bi = players.indexOf(side[j]);
            partnerCount[ai][bi]++;
            partnerCount[bi][ai]++;
          }
        }
      }
    }
  }
  let maxPartner = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      maxPartner = Math.max(maxPartner, partnerCount[i][j]);
    }
  }
  assert.ok(maxPartner <= 1,
    `14p/4t: max partner repeat should be ≤1, got ${maxPartner}`);
});

// --- Format assignment edge cases ---

test('decideTableFormats prefers MORE tables when available (6p/3t = [2,2,2] not [4,2])', () => {
  const formats = Scheduler.decideTableFormats(6, 3);
  assert.strictEqual(formats.length, 3, 'should use all 3 tables');
  assert.deepStrictEqual(formats.sort((a, b) => b - a), [2, 2, 2]);
});

test('decideTableFormats with 1 table always returns single format', () => {
  for (let n = 2; n <= 4; n++) {
    const formats = Scheduler.decideTableFormats(n, 1);
    assert.strictEqual(formats.length, 1,
      `${n} players, 1 table: should return exactly 1 format`);
    assert.strictEqual(formats[0], n,
      `${n} players, 1 table: format should be ${n}`);
  }
});

test('boundary: 2 players (minimum) generates valid schedule', () => {
  const players = [
    { name: 'A', colorIndex: 0 },
    { name: 'B', colorIndex: 1 }
  ];
  const rounds = Scheduler.generateSchedule(players, 1);
  assert.strictEqual(rounds.length, 1);
  assert.strictEqual(rounds[0].tables.length, 1);
  assert.strictEqual(rounds[0].tables[0].format, 'singles');
  const all = [...rounds[0].tables[0].sideA, ...rounds[0].tables[0].sideB];
  assert.strictEqual(all.length, 2);
});

test('boundary: 14 players (maximum) generates valid schedule', () => {
  const players = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
  const rounds = Scheduler.generateSchedule(players, 5);
  assert.ok(rounds.length > 0, 'should generate at least 1 round');
  for (const round of rounds) {
    const names = new Set();
    for (const t of round.tables) {
      for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
    }
    assert.strictEqual(names.size, 14, 'all 14 players should play each round');
  }
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
