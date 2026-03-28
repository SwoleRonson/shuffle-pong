/**
 * One-off diagnostic sweep: test every player/table/option combo
 * and report quality metrics to find improvement areas.
 *
 * Run: /opt/homebrew/bin/node tests/sweep-diagnostics.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadScheduler() {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf-8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) throw new Error('Could not find scheduler script');
  new Function(scriptMatch[1])();
  return globalThis.Scheduler;
}

const S = loadScheduler();

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: `P${i + 1}`,
    colorIndex: i
  }));
}

function analyse(players, rounds) {
  const n = players.length;
  const opp = Array.from({ length: n }, () => Array(n).fill(0));
  const par = Array.from({ length: n }, () => Array(n).fill(0));
  const soloPerPlayer = Array(n).fill(0);
  const gamesPerPlayer = Array(n).fill(0);
  const sitOutPerPlayer = Array(n).fill(0);

  for (const round of rounds) {
    const played = new Set();
    for (const table of round.tables) {
      for (const a of table.sideA) for (const b of table.sideB) {
        const ai = players.indexOf(a), bi = players.indexOf(b);
        opp[ai][bi]++; opp[bi][ai]++;
      }
      for (const side of [table.sideA, table.sideB]) {
        for (let i = 0; i < side.length; i++) {
          const pi = players.indexOf(side[i]);
          played.add(pi);
          gamesPerPlayer[pi]++;
          if (side.length === 1) soloPerPlayer[pi]++;
          for (let j = i + 1; j < side.length; j++) {
            const qi = players.indexOf(side[j]);
            par[pi][qi]++; par[qi][pi]++;
          }
        }
      }
    }
    // Sit-outs (use played set to avoid double-counting)
    for (let i = 0; i < n; i++) {
      if (!played.has(i)) sitOutPerPlayer[i]++;
    }
  }

  // Opponent metrics
  let oppMin = Infinity, oppMax = 0, oppZeros = 0, oppTotal = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      oppMin = Math.min(oppMin, opp[i][j]);
      oppMax = Math.max(oppMax, opp[i][j]);
      if (opp[i][j] === 0) oppZeros++;
      oppTotal++;
    }

  // Partner metrics
  let parMin = Infinity, parMax = 0, parZeros = 0, parTotal = 0;
  const hasPartnerFormats = rounds.some(r => r.tables.some(t =>
    t.format === 'doubles' || t.format === '2v1'));
  if (hasPartnerFormats) {
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        parMin = Math.min(parMin, par[i][j]);
        parMax = Math.max(parMax, par[i][j]);
        if (par[i][j] === 0) parZeros++;
        parTotal++;
      }
  }

  // Solo streak (max consecutive solo rounds per player)
  const soloStreaks = Array(n).fill(0);
  const currentStreak = Array(n).fill(0);
  for (const round of rounds) {
    const soloThisRound = new Set();
    for (const table of round.tables)
      for (const side of [table.sideA, table.sideB])
        if (side.length === 1) soloThisRound.add(players.indexOf(side[0]));
    for (let i = 0; i < n; i++) {
      // Only count streaks for players who actually played this round
      const played = round.tables.some(t =>
        [...t.sideA, ...t.sideB].includes(players[i]));
      if (!played) continue; // sitting out doesn't count as solo
      if (soloThisRound.has(i)) {
        currentStreak[i]++;
        soloStreaks[i] = Math.max(soloStreaks[i], currentStreak[i]);
      } else {
        currentStreak[i] = 0;
      }
    }
  }

  // Sit-out fairness
  const sitMin = Math.min(...sitOutPerPlayer);
  const sitMax = Math.max(...sitOutPerPlayer);

  // Games fairness
  const gamesMin = Math.min(...gamesPerPlayer);
  const gamesMax = Math.max(...gamesPerPlayer);

  return {
    rounds: rounds.length,
    oppCoverage: `${oppTotal - oppZeros}/${oppTotal}`,
    oppCoveragePct: Math.round((oppTotal - oppZeros) / oppTotal * 100),
    oppMax,
    parCoverage: hasPartnerFormats ? `${parTotal - parZeros}/${parTotal}` : 'n/a',
    parCoveragePct: hasPartnerFormats ? Math.round((parTotal - parZeros) / parTotal * 100) : null,
    parMax,
    maxSoloStreak: Math.max(...soloStreaks),
    avgSoloStreak: soloStreaks.some(s => s > 0)
      ? (soloStreaks.reduce((a, b) => a + b, 0) / soloStreaks.filter(s => s > 0).length).toFixed(1)
      : 0,
    sitOutFairness: sitMax > 0 ? `${sitMin}-${sitMax} (spread ${sitMax - sitMin})` : 'none',
    gamesFairness: `${gamesMin}-${gamesMax}`,
  };
}

// Run the sweep
console.log('=== COMPREHENSIVE SCHEDULE QUALITY SWEEP ===\n');

const configs = [];
for (let n = 2; n <= 14; n++) {
  const maxTables = Math.floor(n / 2);
  for (let t = 1; t <= maxTables; t++) {
    for (const allow2v1 of [true, false]) {
      configs.push({ n, t, allow2v1 });
    }
  }
}

const issues = [];

console.log('Players | Tables | 2v1 | Rounds | OppCov% | OppMax | ParCov% | ParMax | MaxSolo | SitOut | Games');
console.log('--------|--------|-----|--------|---------|--------|---------|--------|---------|--------|------');

for (const { n, t, allow2v1 } of configs) {
  const players = makePlayers(n);
  const formats = S.decideTableFormats(n, t, allow2v1);

  let result;
  try {
    result = S.generateSchedule(players, t, allow2v1);
  } catch (e) {
    console.log(`${String(n).padStart(7)} | ${String(t).padStart(6)} | ${allow2v1 ? 'yes' : ' no'} | ERROR: ${e.message}`);
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `Error: ${e.message}` });
    continue;
  }

  const rounds = result.rounds || result;
  const stats = analyse(players, rounds);

  const parCovStr = stats.parCoveragePct !== null ? `${stats.parCoveragePct}%` : 'n/a';

  console.log(
    `${String(n).padStart(7)} | ${String(t).padStart(6)} | ${allow2v1 ? 'yes' : ' no'} | ` +
    `${String(stats.rounds).padStart(6)} | ${String(stats.oppCoveragePct + '%').padStart(7)} | ` +
    `${String(stats.oppMax).padStart(6)} | ${String(parCovStr).padStart(7)} | ` +
    `${String(stats.parMax).padStart(6)} | ${String(stats.maxSoloStreak).padStart(7)} | ` +
    `${stats.sitOutFairness.padStart(6)} | ${stats.gamesFairness}`
  );

  // Flag potential issues
  if (stats.oppCoveragePct < 100) {
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `Opponent coverage only ${stats.oppCoveragePct}%` });
  }
  if (stats.parCoveragePct !== null && stats.parCoveragePct < 100 && stats.rounds < 20) {
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `Partner coverage ${stats.parCoveragePct}% (${stats.rounds} rounds, not capped)` });
  }
  if (stats.oppMax >= 4) {
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `High opponent repeat: ${stats.oppMax}` });
  }
  if (stats.parMax >= 3) {
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `High partner repeat: ${stats.parMax}` });
  }
  if (stats.maxSoloStreak >= 4) {
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `High solo streak: ${stats.maxSoloStreak}` });
  }
  const sitSpread = stats.sitOutFairness.match(/spread (\d+)/);
  if (sitSpread && parseInt(sitSpread[1]) > 1) {
    issues.push({ config: `${n}p/${t}t/2v1=${allow2v1}`, issue: `Sit-out unfairness: ${stats.sitOutFairness}` });
  }
}

console.log('\n=== FLAGGED ISSUES ===\n');
if (issues.length === 0) {
  console.log('No issues found!');
} else {
  for (const { config, issue } of issues) {
    console.log(`  ${config}: ${issue}`);
  }
}
console.log(`\nTotal configs tested: ${configs.length}`);
console.log(`Issues found: ${issues.length}`);
