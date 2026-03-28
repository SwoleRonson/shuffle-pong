# Shuffle Pong

Single-page table tennis group scheduler. Single HTML file, Tailwind via CDN, vanilla JS.

## Run

Open `index.html` in a browser, or serve with any static server.

## Test

```bash
# Unit tests (56 tests — schedule algorithm, format assignment, edge cases)
/opt/homebrew/bin/node tests/test-scheduler.mjs

# UI tests (40 tests — requires agent-browser CLI)
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

## Limitations

- **14 player cap**: The greedy algorithm for mixed formats cannot reliably achieve unique partnerships for 15+ players within acceptable time. Raising the cap would require either extending the circle method to mixed formats or relaxing the "no repeated partnerships" constraint.
- **Odd player counts with few tables** (e.g. 15p/4t): The 2v1 format makes the combinatorial space harder to optimise. The circle method currently only handles even player counts.
