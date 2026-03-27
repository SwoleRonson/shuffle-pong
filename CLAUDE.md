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
