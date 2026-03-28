# Shuffle Pong

Single-page table tennis group scheduler. Single HTML file, Tailwind via CDN, vanilla JS.

## Run

Open `index.html` in a browser, or serve with any static server.

## Test

```bash
# Unit tests (99 tests — schedule algorithm, format assignment, partner coverage, solo fairness, debug analyser)
/opt/homebrew/bin/node tests/test-scheduler.mjs

# UI tests (49 tests — requires agent-browser CLI)
./tests/test-ui.sh
```

## Deploy

GitHub Pages from main branch. Push to main to deploy.

## Architecture

- `index.html` — the complete app (HTML + CSS + JS)
- `tests/test-scheduler.mjs` — unit tests for scheduler algorithm
- `tests/test-ui.sh` — UI integration tests using agent-browser
- Scheduler functions are exposed on `globalThis.Scheduler` for testability

## Scheduling Algorithm

Two strategies, chosen automatically:

- **Circle method** (1-factorization): Used for even player counts with all-doubles or all-singles formats. Instant, guarantees unique partnerships. Examples: 4p/1t, 8p/4t, 12p/3t, 16p/4t.
- **Greedy multi-candidate**: Used for mixed formats (doubles + singles + 2v1). Generates multiple random schedules within a 15s time limit, picks the best. Examples: 10p/4t, 11p/4t, 14p/4t.

### Stopping condition

Schedule generation continues until **all opponent pairs AND all partner pairs** have been covered (or the 40-round cap). All-singles formats skip the partner check since there are no partnerships. This maximises variation for groups that play through the full schedule.

### Scoring

Round assignment uses equal-weight scoring: `oppCost + partCost + soloCost`. The solo cost tracks how many times each player has played alone (singles or solo side of 2v1) and rotates solo play to prevent consecutive solo streaks.

### URL sync

Player names persist in the URL hash (`#Name1,Name2,Name3`). Refreshing restores the setup with names pre-filled.

## Limitations

- **14 player cap**: The greedy algorithm for mixed formats cannot reliably achieve unique partnerships for 15+ players within acceptable time. Raising the cap would require either extending the circle method to mixed formats or relaxing the "no repeated partnerships" constraint.
- **Odd player counts with few tables** (e.g. 15p/4t): The 2v1 format makes the combinatorial space harder to optimise. The circle method currently only handles even player counts.
- **Partner repeats with extended schedules**: When schedules run long enough for full partner coverage, some configs (e.g. 6p/2t) unavoidably repeat one partnership due to slot math. The scoring heavily penalises repeats (`parMax * 10000`) to minimise this.
