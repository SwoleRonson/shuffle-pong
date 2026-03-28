import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadScheduler() {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf-8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) throw new Error('Could not find scheduler script in index.html');
  new Function(scriptMatch[1])();
  return globalThis.Scheduler;
}

// ===== Test definitions =====
// Each test is { name, fn } where fn receives Scheduler and uses assert.

function allTests() {
  const tests = [];
  function test(name, fn) { tests.push({ name, fn }); }

  // --- decideTableFormats tests ---

  test('2 players, 1 table → 1× singles', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(2, 1), [2]);
  });

  test('3 players, 1 table → 1× 2v1', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(3, 1), [3]);
  });

  test('4 players, 1 table → 1× doubles', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(4, 1), [4]);
  });

  test('4 players, 2 tables → 2× singles (prefers more tables)', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(4, 2).sort((a, b) => b - a), [2, 2]);
  });

  test('5 players, 2 tables → 1× 2v1 + 1× singles', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(5, 2).sort((a, b) => b - a), [3, 2]);
  });

  test('6 players, 2 tables → 1× doubles + 1× singles', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(6, 2).sort((a, b) => b - a), [4, 2]);
  });

  test('7 players, 2 tables → 1× doubles + 1× 2v1', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(7, 2).sort((a, b) => b - a), [4, 3]);
  });

  test('8 players, 2 tables → 2× doubles', (S) => {
    assert.deepStrictEqual(S.decideTableFormats(8, 2).sort((a, b) => b - a), [4, 4]);
  });

  test('7 players, 3 tables → uses all 3 tables (2v1 + singles + singles)', (S) => {
    const formats = S.decideTableFormats(7, 3);
    assert.strictEqual(formats.length, 3);
    assert.strictEqual(formats.reduce((a, b) => a + b, 0), 7);
    assert.deepStrictEqual(formats.sort((a, b) => b - a), [3, 2, 2]);
  });

  test('6 players, 3 tables → uses all 3 tables (3× singles)', (S) => {
    const formats = S.decideTableFormats(6, 3);
    assert.strictEqual(formats.length, 3);
    assert.deepStrictEqual(formats, [2, 2, 2]);
  });

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

  test('under-capacity: 9p/2t, allow2v1=true → [4,4] (8 play, 1 sits out)', (S) => {
    const formats = S.decideTableFormats(9, 2, true);
    assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
  });

  test('under-capacity: 9p/2t, allow2v1=false → [4,4] (8 play, 1 sits out)', (S) => {
    const formats = S.decideTableFormats(9, 2, false);
    assert.deepStrictEqual(formats.sort((a, b) => b - a), [4, 4]);
  });

  // --- min tables constraint ---

  test('5 players need at least 2 tables (max 4 per table)', (S) => {
    const formats = S.decideTableFormats(5, 2);
    assert.strictEqual(formats.reduce((a, b) => a + b, 0), 5);
    assert.ok(formats.every(f => f <= 4));
  });

  test('9 players need at least 3 tables', (S) => {
    const formats = S.decideTableFormats(9, 3);
    assert.strictEqual(formats.reduce((a, b) => a + b, 0), 9);
    assert.ok(formats.every(f => f <= 4));
  });

  test('decideTableFormats: no table exceeds 4 players for 2-20 players', (S) => {
    for (let n = 2; n <= 20; n++) {
      const minT = Math.ceil(n / 4);
      const maxT = Math.floor(n / 2);
      for (let t = minT; t <= maxT; t++) {
        const formats = S.decideTableFormats(n, t);
        const total = formats.reduce((a, b) => a + b, 0);
        assert.strictEqual(total, n, `${n}p/${t}t total`);
        assert.ok(formats.every(f => f >= 2 && f <= 4), `${n}p/${t}t range`);
      }
    }
  });

  // --- assignRound tests ---

  test('assignRound with 2 players produces valid singles match', (S) => {
    const players = [{ name: 'A', colorIndex: 0 }, { name: 'B', colorIndex: 1 }];
    const opp = [[0, 0], [0, 0]], par = [[0, 0], [0, 0]];
    const round = S.assignRound(players, [2], opp, par);
    assert.strictEqual(round.tables.length, 1);
    assert.strictEqual(round.tables[0].format, 'singles');
    assert.strictEqual(round.tables[0].sideA.length, 1);
    assert.strictEqual(round.tables[0].sideB.length, 1);
  });

  test('assignRound with 3 players produces 2v1', (S) => {
    const players = [{ name: 'A', colorIndex: 0 }, { name: 'B', colorIndex: 1 }, { name: 'C', colorIndex: 2 }];
    const n = 3;
    const opp = Array.from({ length: n }, () => Array(n).fill(0));
    const par = Array.from({ length: n }, () => Array(n).fill(0));
    const round = S.assignRound(players, [3], opp, par);
    assert.strictEqual(round.tables.length, 1);
    assert.strictEqual(round.tables[0].format, '2v1');
    assert.strictEqual(round.tables[0].sideA.length + round.tables[0].sideB.length, 3);
  });

  // --- generateSchedule tests ---

  test('generateSchedule: no sit-outs (every round uses all players)', (S) => {
    const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    for (const round of rounds) {
      const names = new Set();
      for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
      assert.strictEqual(names.size, 6);
    }
  });

  test('generateSchedule: opponent variety (6 players, every pair meets)', (S) => {
    const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    const n = 6;
    const met = Array.from({ length: n }, () => Array(n).fill(false));
    for (const round of rounds)
      for (const table of round.tables)
        for (const a of table.sideA) for (const b of table.sideB) {
          met[players.indexOf(a)][players.indexOf(b)] = true;
          met[players.indexOf(b)][players.indexOf(a)] = true;
        }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        assert.ok(met[i][j], `P${i} and P${j} never met`);
  });

  test('generateSchedule: full partner coverage with minimal repeats (8p, 3 tables)', (S) => {
    const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 3);
    assert.ok(maxPartnerCount(players, rounds) <= 2, 'partner repeats should be minimal');
    assert.strictEqual(partnerCoverage(players, rounds), 28, 'all 28 partner pairs should be covered');
  });

  test('generateSchedule: 4 players, 1 table — no repeated partnerships', (S) => {
    const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1);
    assert.ok(maxPartnerCount(players, rounds) <= 1);
  });

  test('generateSchedule: 2 players produces exactly 1 round', (S) => {
    const players = [{ name: 'A', colorIndex: 0 }, { name: 'B', colorIndex: 1 }];
    assert.strictEqual(S.generateSchedule(players, 1).length, 1);
  });

  // --- Schedule quality sweep (2-14 players) ---

  for (let n = 2; n <= 14; n++) {
    const minTables = Math.ceil(n / 4);
    const maxTables = Math.floor(n / 2);
    for (let t = minTables; t <= Math.min(maxTables, 5); t++) {
      const formats = loadScheduler().decideTableFormats(n, t);
      const hasTeams = formats.some(f => f >= 3);

      test(`schedule quality: ${n}p/${t}t — sit-outs, table size, opponents${hasTeams ? ', partnerships' : ''}`, (S) => {
        const players = Array.from({ length: n }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
        const rounds = S.generateSchedule(players, t);
        assert.ok(rounds.length > 0);

        for (let ri = 0; ri < rounds.length; ri++) {
          const names = new Set();
          for (let ti = 0; ti < rounds[ri].tables.length; ti++) {
            const table = rounds[ri].tables[ti];
            assert.ok(table.sideA.length + table.sideB.length <= 4,
              `R${ri + 1} T${ti + 1}: >4 players`);
            for (const p of [...table.sideA, ...table.sideB]) names.add(p.name);
          }
          assert.strictEqual(names.size, n, `R${ri + 1}: ${names.size}/${n} players`);
        }

        const met = Array.from({ length: n }, () => Array(n).fill(false));
        const partnerCount = Array.from({ length: n }, () => Array(n).fill(0));
        for (const round of rounds)
          for (const table of round.tables) {
            for (const a of table.sideA) for (const b of table.sideB) {
              met[players.indexOf(a)][players.indexOf(b)] = true;
              met[players.indexOf(b)][players.indexOf(a)] = true;
            }
            for (const side of [table.sideA, table.sideB])
              for (let i = 0; i < side.length; i++)
                for (let j = i + 1; j < side.length; j++) {
                  partnerCount[players.indexOf(side[i])][players.indexOf(side[j])]++;
                  partnerCount[players.indexOf(side[j])][players.indexOf(side[i])]++;
                }
          }

        let unmetPairs = 0;
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++)
            if (!met[i][j]) unmetPairs++;

        const allDoubles = formats.every(f => f === 4);
        const maxUnmet = (allDoubles && formats.length >= 3) ? 2 : 0;
        assert.ok(unmetPairs <= maxUnmet, `${unmetPairs} unmet pairs (max ${maxUnmet})`);

        if (hasTeams) {
          let maxP = 0;
          for (let i = 0; i < n; i++)
            for (let j = i + 1; j < n; j++)
              maxP = Math.max(maxP, partnerCount[i][j]);
          assert.ok(maxP <= 2, `maxPartner=${maxP}`);
        }
      });
    }
  }

  // --- Specific edge cases ---

  test('edge case: 3 players, 1 table — 2v1 format, all 3 play', (S) => {
    const players = Array.from({ length: 3 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      assert.strictEqual(round.tables.length, 1);
      assert.strictEqual(round.tables[0].format, '2v1');
      assert.strictEqual(round.tables[0].sideA.length + round.tables[0].sideB.length, 3);
    }
  });

  test('edge case: 5 players, 2 tables — 2v1 + singles, no sit-outs', (S) => {
    const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      assert.strictEqual(round.tables.length, 2);
      assert.deepStrictEqual(round.tables.map(t => t.format).sort(), ['2v1', 'singles']);
      const names = new Set();
      for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
      assert.strictEqual(names.size, 5);
    }
  });

  test('edge case: 7 players, 3 tables — 2v1 + 2 singles, uses all 3 tables', (S) => {
    const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 3);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      assert.strictEqual(round.tables.length, 3);
      assert.deepStrictEqual(round.tables.map(t => t.format).sort(), ['2v1', 'singles', 'singles']);
      const names = new Set();
      for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
      assert.strictEqual(names.size, 7);
    }
  });

  test('edge case: 12 players, 3 tables — all-doubles, circle method, unique partnerships', (S) => {
    const players = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 3);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      assert.strictEqual(round.tables.length, 3);
      for (const t of round.tables) {
        assert.strictEqual(t.sideA.length, 2);
        assert.strictEqual(t.sideB.length, 2);
      }
    }
    assert.ok(maxPartnerCount(players, rounds) <= 1);
  });

  test('edge case: 14 players, 4 tables — full partner coverage within time limit', (S) => {
    const players = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const start = Date.now();
    const rounds = S.generateSchedule(players, 4);
    assert.ok(Date.now() - start < 60000, 'exceeded 60s');
    assert.ok(rounds.length > 0);
    for (let ri = 0; ri < rounds.length; ri++) {
      const names = new Set();
      for (const t of rounds[ri].tables) for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
      assert.strictEqual(names.size, 14);
    }
    assert.ok(maxPartnerCount(players, rounds) <= 2, 'partner repeats should be minimal');
    assert.strictEqual(partnerCoverage(players, rounds), 91, 'all 91 partner pairs should be covered');
  });

  // --- Format assignment edge cases ---

  test('decideTableFormats prefers MORE tables when available (6p/3t = [2,2,2] not [4,2])', (S) => {
    const formats = S.decideTableFormats(6, 3);
    assert.strictEqual(formats.length, 3);
    assert.deepStrictEqual(formats.sort((a, b) => b - a), [2, 2, 2]);
  });

  test('decideTableFormats with 1 table always returns single format', (S) => {
    for (let n = 2; n <= 4; n++) {
      const formats = S.decideTableFormats(n, 1);
      assert.strictEqual(formats.length, 1);
      assert.strictEqual(formats[0], n);
    }
  });

  test('boundary: 2 players (minimum) generates valid schedule', (S) => {
    const players = [{ name: 'A', colorIndex: 0 }, { name: 'B', colorIndex: 1 }];
    const rounds = S.generateSchedule(players, 1);
    assert.strictEqual(rounds.length, 1);
    assert.strictEqual(rounds[0].tables.length, 1);
    assert.strictEqual(rounds[0].tables[0].format, 'singles');
    assert.strictEqual([...rounds[0].tables[0].sideA, ...rounds[0].tables[0].sideB].length, 2);
  });

  test('boundary: 14 players (maximum) generates valid schedule', (S) => {
    const players = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 5);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      const names = new Set();
      for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) names.add(p.name);
      assert.strictEqual(names.size, 14);
    }
  });

  // --- Sit-out scheduling ---

  test('sit-out: 6p/1t produces rounds with sittingOut array', (S) => {
    const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1, true);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      assert.ok(Array.isArray(round.sittingOut), 'round should have sittingOut array');
      assert.strictEqual(round.sittingOut.length, 2, '6p/1t(doubles): 2 sit out');
      const active = new Set();
      for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) active.add(p.name);
      const bench = new Set(round.sittingOut.map(p => p.name));
      assert.strictEqual(active.size + bench.size, 6);
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

  test('sit-out: rotation is fair with odd divisor (7p/1t, 3 sit out)', (S) => {
    const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1, true);
    const sitCounts = {};
    for (const p of players) sitCounts[p.name] = 0;
    for (const round of rounds) {
      for (const p of round.sittingOut) sitCounts[p.name]++;
    }
    const counts = Object.values(sitCounts);
    const diff = Math.max(...counts) - Math.min(...counts);
    assert.ok(diff <= 1, `Sit-out fairness 7p/1t: max-min=${diff}, counts=${JSON.stringify(sitCounts)}`);
  });

  test('sit-out: rotation is fair with many players few tables (14p/2t, 6 sit out)', (S) => {
    const players = Array.from({ length: 14 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, true);
    const sitCounts = {};
    for (const p of players) sitCounts[p.name] = 0;
    for (const round of rounds) {
      for (const p of round.sittingOut) sitCounts[p.name]++;
    }
    const counts = Object.values(sitCounts);
    const diff = Math.max(...counts) - Math.min(...counts);
    assert.ok(diff <= 1, `Sit-out fairness 14p/2t: max-min=${diff}, counts=${JSON.stringify(sitCounts)}`);
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
      assert.strictEqual(round.sittingOut.length, 2);
    }
  });

  // --- Partner coverage (stopping condition extends for partnerships) ---

  test('partner coverage: 4p/1t — all 6 partner pairs covered', (S) => {
    const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1);
    assert.strictEqual(partnerCoverage(players, rounds), 6);
  });

  test('partner coverage: 5p/2t — all 10 partner pairs covered', (S) => {
    const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    assert.strictEqual(partnerCoverage(players, rounds), 10);
  });

  test('partner coverage: 7p/2t — all 21 partner pairs covered', (S) => {
    const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    assert.strictEqual(partnerCoverage(players, rounds), 21);
  });

  test('partner coverage: 8p/2t — all 28 partner pairs covered', (S) => {
    const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    assert.strictEqual(partnerCoverage(players, rounds), 28);
  });

  test('partner coverage: all-singles (4p/2t) — no partners, stops at opponent coverage', (S) => {
    const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    // All-singles: should still stop at opponent coverage (3 rounds for 4p round-robin)
    assert.ok(rounds.length <= 4, `all-singles should not over-generate: got ${rounds.length}`);
  });

  test('partner coverage: round cap prevents explosion (9p/4t)', (S) => {
    const players = Array.from({ length: 9 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 4);
    assert.ok(rounds.length <= 40, `should not exceed 40 rounds: got ${rounds.length}`);
  });

  test('partner coverage: sit-out path extends for partners (6p/1t)', (S) => {
    const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1);
    // 6p/1t [4] with 2 sit-outs: 2 partnerships/round, 15 pairs, needs ~8 rounds
    assert.ok(rounds.length >= 6, `should extend beyond opponent-only: got ${rounds.length}`);
    assert.strictEqual(partnerCoverage(players, rounds), 15);
  });

  test('partner coverage: all-singles larger config (6p/3t) stops at opponent coverage', (S) => {
    const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 3);
    // 6p/3t = [2,2,2] all-singles, 5 rounds for opponent coverage
    assert.ok(rounds.length <= 6, `all-singles should not over-generate: got ${rounds.length}`);
  });

  test('partner coverage: allow2v1=false converts to all-singles, no over-generation (5p/2t)', (S) => {
    const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, false);
    // 5p/2t allow2v1=false → [2,2] with 1 sit-out, no partnerships possible
    assert.ok(rounds.length <= 12, `should not over-generate when no partner formats: got ${rounds.length}`);
  });

  // --- Solo streak fairness (solo rotation prevents consecutive solo play) ---

  // Helper: compute worst solo streak across all players
  function worstSoloStreak(players, rounds) {
    const maxStreak = {};
    const cur = {};
    for (const p of players) { maxStreak[p.name] = 0; cur[p.name] = 0; }
    for (const round of rounds) {
      const partnered = new Set();
      for (const t of round.tables)
        for (const side of [t.sideA, t.sideB])
          if (side.length >= 2) for (const p of side) partnered.add(p.name);
      for (const p of players) {
        if (!partnered.has(p.name)) {
          cur[p.name]++;
          maxStreak[p.name] = Math.max(maxStreak[p.name], cur[p.name]);
        } else {
          cur[p.name] = 0;
        }
      }
    }
    return Math.max(...Object.values(maxStreak));
  }

  test('solo streak: 5p/2t — worst solo streak ≤ 4 (avg over 5 trials)', (S) => {
    let totalWorst = 0;
    for (let t = 0; t < 5; t++) {
      const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
      const rounds = S.generateSchedule(players, 2);
      totalWorst += worstSoloStreak(players, rounds);
    }
    const avg = totalWorst / 5;
    assert.ok(avg <= 4, `avg worst solo streak should be ≤ 4, got ${avg}`);
  });

  test('solo streak: 6p/2t — worst solo streak ≤ 3', (S) => {
    let totalWorst = 0;
    for (let t = 0; t < 5; t++) {
      const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
      const rounds = S.generateSchedule(players, 2);
      totalWorst += worstSoloStreak(players, rounds);
    }
    const avg = totalWorst / 5;
    assert.ok(avg <= 3, `avg worst solo streak should be ≤ 3, got ${avg}`);
  });

  test('solo streak: 7p/2t — worst solo streak ≤ 2', (S) => {
    let totalWorst = 0;
    for (let t = 0; t < 5; t++) {
      const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
      const rounds = S.generateSchedule(players, 2);
      totalWorst += worstSoloStreak(players, rounds);
    }
    const avg = totalWorst / 5;
    assert.ok(avg <= 2, `avg worst solo streak should be ≤ 2, got ${avg}`);
  });

  test('solo streak: all-doubles (8p/2t) — streak is 0 (everyone always partnered)', (S) => {
    const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    assert.strictEqual(worstSoloStreak(players, rounds), 0);
  });

  test('solo streak: does not degrade opponent coverage (5p/2t)', (S) => {
    const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2);
    const n = 5;
    const met = Array.from({ length: n }, () => Array(n).fill(false));
    for (const round of rounds)
      for (const table of round.tables)
        for (const a of table.sideA) for (const b of table.sideB) {
          met[players.indexOf(a)][players.indexOf(b)] = true;
          met[players.indexOf(b)][players.indexOf(a)] = true;
        }
    let unmet = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (!met[i][j]) unmet++;
    assert.strictEqual(unmet, 0, 'all opponent pairs should still be covered');
  });

  // --- Integration: allow2v1=false with sit-outs ---

  test('allow2v1=false with sit-outs: 7p/2t → [4,2], 1 sits out, no 2v1', (S) => {
    const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, false);
    assert.ok(rounds.length > 0);
    for (const round of rounds) {
      for (const t of round.tables) {
        assert.notStrictEqual(t.format, '2v1', 'no 2v1 tables when allow2v1=false');
      }
      assert.strictEqual(round.sittingOut.length, 1);
      const active = new Set();
      for (const t of round.tables) for (const p of [...t.sideA, ...t.sideB]) active.add(p.name);
      assert.strictEqual(active.size + round.sittingOut.length, 7);
    }
  });

  test('allow2v1=false: all configs 2-14p produce valid schedules with no 2v1', (S) => {
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

  // --- analyseSchedule tests ---

  test('analyseSchedule: returns correct structure and strategy for all-singles', (S) => {
    const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, true);
    const stats = S.analyseSchedule(players, rounds);
    assert.strictEqual(typeof stats.strategy, 'string');
    assert.strictEqual(typeof stats.roundCount, 'number');
    assert.strictEqual(stats.roundCount, rounds.length);
    assert.ok(stats.stoppedReason, 'should have a stopped reason');
    assert.ok(stats.opponent, 'should have opponent stats');
    assert.strictEqual(stats.opponent.total, 6); // C(4,2) = 6
    assert.ok(stats.opponent.pct >= 0 && stats.opponent.pct <= 100);
    assert.strictEqual(stats.partner, null, '4p/2t all-singles has no partner stats');
    assert.ok(stats.fairness, 'should have fairness stats');
    assert.strictEqual(stats.notes instanceof Array, true);
  });

  test('analyseSchedule: opponent coverage is 100% for completed schedule', (S) => {
    const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 3, true);
    const stats = S.analyseSchedule(players, rounds);
    assert.strictEqual(stats.opponent.pct, 100, 'all opponent pairs should be covered');
    assert.strictEqual(stats.opponent.covered, stats.opponent.total);
  });

  test('analyseSchedule: partner stats present for doubles/2v1 formats', (S) => {
    const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, true);
    const stats = S.analyseSchedule(players, rounds);
    assert.ok(stats.partner !== null, '5p/2t should have partner stats');
    assert.strictEqual(stats.partner.total, 10); // C(5,2) = 10
    assert.ok(stats.partner.pct >= 0 && stats.partner.pct <= 100);
    assert.ok(Array.isArray(stats.partner.repeats));
  });

  test('analyseSchedule: sit-out fairness tracked correctly', (S) => {
    const players = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 1, true);
    const stats = S.analyseSchedule(players, rounds);
    assert.ok(stats.fairness.sitMax > 0, '7p/1t should have sit-outs');
    assert.ok(stats.fairness.sitSpread <= 1, `Sit-out spread should be <= 1, got ${stats.fairness.sitSpread}`);
    assert.strictEqual(stats.fairness.sitOutPerPlayer.length, 7);
    assert.strictEqual(stats.fairness.gamesPerPlayer.length, 7);
  });

  test('analyseSchedule: strategy label describes method used', (S) => {
    // All-singles with 4p/2t → round-robin
    const p4 = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const r4 = S.generateSchedule(p4, 2, true);
    const s4 = S.analyseSchedule(p4, r4);
    assert.ok(s4.strategy.includes('round-robin') || s4.strategy.includes('Optimal'),
      `4p/2t should be round-robin, got: ${s4.strategy}`);

    // 7p/1t with sit-outs → greedy with sit-out rotation
    const p7 = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const r7 = S.generateSchedule(p7, 1, true);
    const s7 = S.analyseSchedule(p7, r7);
    assert.ok(s7.strategy.includes('sit-out'),
      `7p/1t should mention sit-out rotation, got: ${s7.strategy}`);
  });

  test('analyseSchedule: notes flag imperfections correctly', (S) => {
    // A config that produces a perfect schedule should have no notes about missing coverage
    const players = Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, true);
    const stats = S.analyseSchedule(players, rounds);
    const missingOpp = stats.notes.filter(n => n.includes('opponent'));
    assert.strictEqual(missingOpp.length, 0, '4p/2t should have full opponent coverage, no notes');
  });

  test('analyseSchedule: solo streak tracked', (S) => {
    const players = Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, true);
    const stats = S.analyseSchedule(players, rounds);
    assert.strictEqual(typeof stats.fairness.maxSoloStreak, 'number');
    assert.ok(stats.fairness.maxSoloStreak >= 0);
    assert.strictEqual(stats.fairness.soloPerPlayer.length, 5);
  });

  test('analyseSchedule: games per player has correct spread', (S) => {
    const players = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, colorIndex: i }));
    const rounds = S.generateSchedule(players, 2, true);
    const stats = S.analyseSchedule(players, rounds);
    // All players active (no sit-outs for 8p/2t), so all should play the same number of games
    assert.strictEqual(stats.fairness.gamesMin, stats.fairness.gamesMax,
      `8p/2t: all players should play same games, got ${stats.fairness.gamesMin}-${stats.fairness.gamesMax}`);
  });

  return tests;
}

// ===== Shared helpers =====

function partnerCoverage(players, rounds) {
  const n = players.length;
  const met = Array.from({ length: n }, () => Array(n).fill(false));
  for (const round of rounds)
    for (const table of round.tables)
      for (const side of [table.sideA, table.sideB])
        for (let i = 0; i < side.length; i++)
          for (let j = i + 1; j < side.length; j++) {
            met[players.indexOf(side[i])][players.indexOf(side[j])] = true;
            met[players.indexOf(side[j])][players.indexOf(side[i])] = true;
          }
  let covered = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (met[i][j]) covered++;
  return covered;
}

function maxPartnerCount(players, rounds) {
  const n = players.length;
  const pc = Array.from({ length: n }, () => Array(n).fill(0));
  for (const round of rounds)
    for (const table of round.tables)
      for (const side of [table.sideA, table.sideB])
        for (let i = 0; i < side.length; i++)
          for (let j = i + 1; j < side.length; j++) {
            pc[players.indexOf(side[i])][players.indexOf(side[j])]++;
            pc[players.indexOf(side[j])][players.indexOf(side[i])]++;
          }
  let max = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      max = Math.max(max, pc[i][j]);
  return max;
}

// ===== Worker thread: runs a single test =====

if (!isMainThread) {
  const { testIndex } = workerData;
  const Scheduler = loadScheduler();
  const tests = allTests();
  const t = tests[testIndex];
  try {
    t.fn(Scheduler);
    parentPort.postMessage({ index: testIndex, name: t.name, pass: true });
  } catch (e) {
    parentPort.postMessage({ index: testIndex, name: t.name, pass: false, error: e.message });
  }
  process.exit(0);
}

// ===== Main thread: dispatch workers =====

async function run() {
  const tests = allTests();
  const maxWorkers = Math.min(os.cpus().length, tests.length);
  let passed = 0, failed = 0;
  const results = new Array(tests.length);
  let nextIndex = 0;
  let running = 0;

  await new Promise((resolve) => {
    function spawnNext() {
      while (running < maxWorkers && nextIndex < tests.length) {
        const idx = nextIndex++;
        running++;
        const worker = new Worker(__filename, { workerData: { testIndex: idx } });
        worker.on('message', (msg) => { results[msg.index] = msg; });
        worker.on('exit', () => {
          running--;
          if (nextIndex < tests.length) spawnNext();
          else if (running === 0) resolve();
        });
      }
    }
    spawnNext();
  });

  for (const r of results) {
    if (r.pass) {
      console.log(`  PASS: ${r.name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${r.name}`);
      console.log(`        ${r.error}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
