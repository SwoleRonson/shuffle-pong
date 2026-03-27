# Shuffle Pong — Design Spec

## Overview

A single-page web app that generates rotating rounds of table tennis matchups so everyone plays as many different opponents as possible, with doubles partnerships also varied. Built as a single HTML file with Tailwind CSS (CDN) and vanilla JS, hosted on GitHub Pages.

## Requirements

- **Players:** 2–20 players, names entered in a setup screen.
- **Tables:** User specifies how many tables are available (1+).
- **Formats:** Tables can be singles (1v1), doubles (2v2), or 2v1 as needed.
- **No sit-outs:** Every player plays every round. 2v1 format absorbs odd remainders.
- **Variety:** Prioritise opponent variety first, then partnership variety.
- **Cycling:** When all rounds are played, start from round 1 again.
- **Late arrivals / early leavers:** Edit player list and regenerate.

## UI Design

### Two Views

1. **Setup View** — entry point
2. **Schedule View** — generated schedule with back-navigation

### Setup View

- **Title/branding** at top: "Shuffle Pong" with subtitle.
- **Player input:** Text field + Enter key to add. Players shown as colour-coded pills with × to remove. Colours auto-assigned from a 20-colour palette by player index.
- **Table count:** +/− stepper, min 1, max capped at `floor(playerCount / 2)`.
- **Generate button:** Prominent, full-width. Disabled until ≥ 2 players.
- **Summary line:** Below button, shows what the schedule will look like (e.g. "6 players × 2 tables → singles + doubles").

### Schedule View

- **Header bar:** App title + "Edit Players" button to return to setup.
- **Summary line:** Player count, table count, round count, loop note.
- **Round cards:** Scrollable vertical list, all rounds visible (no pagination). Each card shows:
  - Round number
  - Per-table: format label (Singles / Doubles / 2v1), player pills grouped by side with "vs" separator.
- **"Edit Players" button:** Returns to setup with current player list preserved. User can add/remove players and regenerate.

### Visual Design

- Dark theme (background `#1a1a2e`, cards `#16213e`).
- Tailwind CSS via CDN for utility classes.
- Player pills: rounded, white text on coloured background from the 20-colour palette.
- Mobile-friendly, responsive layout.

### 20-Colour Palette

```
#e74c3c, #3498db, #2ecc71, #f39c12, #9b59b6,
#1abc9c, #e67e22, #2980b9, #27ae60, #f1c40f,
#8e44ad, #16a085, #d35400, #c0392b, #2c3e50,
#7f8c8d, #d4ac0d, #1a5276, #a93226, #117a65
```

Assigned by index: player 0 gets colour 0, player 1 gets colour 1, etc. Wraps at 20.

## Scheduling Algorithm

### Approach: Greedy Round-Robin with Opponent Tracking

Maintain opponent and partner matrices. For each round, greedily assign players to tables minimising opponent repeats, breaking ties by minimising partner repeats.

### Table Format Assignment

Given N players and T available tables:

1. Each table needs 2 (singles), 3 (2v1), or 4 (doubles) players.
2. Find a combination of table formats that seats exactly N players using at most T tables.
3. Prefer doubles (4) and singles (2). Use 2v1 (3) only when needed for odd remainders.
4. May use fewer than T tables if player count is low.

Examples:
- 4 players, 2 tables → 1× doubles = 4 (uses 1 table)
- 5 players, 2 tables → 1× 2v1 + 1× singles = 5 (uses 2 tables)
- 6 players, 2 tables → 1× doubles + 1× singles = 6 (uses 2 tables)
- 7 players, 2 tables → 1× doubles + 1× 2v1 = 7 (uses 2 tables)
- 7 players, 3 tables → 1× doubles + 1× 2v1 = 7 (uses 2 of 3 tables)

### Greedy Assignment Per Round

1. Maintain NxN `opponentMatrix[i][j]` — count of times player i and j have been opponents.
2. Maintain NxN `partnerMatrix[i][j]` — count of times player i and j have been on the same team.
3. For each round:
   a. Determine table formats via the format assignment algorithm.
   b. Start with all players in an unassigned pool.
   c. For each table (largest format first — doubles before singles):
      - From the unassigned pool, select a group of players for this table.
      - Score candidate groupings by: primary = minimise max opponent-repeat among new matchups; secondary = minimise max partner-repeat.
      - Assign the best group to the table. For doubles/2v1, also pick the side split that minimises partner repeats.
      - Remove assigned players from the pool.
   d. Update opponent and partner matrices with this round's matchups.

### Number of Rounds

Generate rounds until every pair of players has been opponents at least once, or until a reasonable cap (e.g. 20 rounds). The exact count depends on player count and table configuration.

### Cycling

No special logic. The UI displays "Repeats from round 1 after completion" and the group simply starts over.

## Project Structure

```
shuffle-pong/
├── index.html              — the complete app (HTML + CSS + JS)
├── tests/
│   └── test-scheduler.mjs  — unit tests for the scheduling algorithm
├── CLAUDE.md               — project instructions for Claude Code
├── README.md               — brief project description
└── .gitignore              — ignores .superpowers/
```

### Code Organisation (within index.html)

```
<style>     — Tailwind CDN + custom dark theme, pill, card styles
<div id="app">  — mount point
<script>
  ├── PALETTE            — 20-colour array
  ├── state              — { players[], tableCount, rounds[], currentView }
  ├── decideTableFormats(playerCount, tableCount) → format[]
  ├── assignRound(players, formats, opponentMatrix, partnerMatrix) → Round
  ├── generateSchedule(players, tableCount) → Round[]
  ├── renderSetup()
  ├── renderSchedule()
  └── Event handlers: addPlayer, removePlayer, generate, editPlayers
</script>
```

### Data Shapes

```js
Player:  { name: string, colorIndex: number }
Table:   { format: 'singles'|'doubles'|'2v1', sideA: Player[], sideB: Player[] }
Round:   { tables: Table[] }
State:   { players: Player[], tableCount: number, rounds: Round[], currentView: 'setup'|'schedule' }
```

### Testing

Unit tests for the scheduler logic, run with `/opt/homebrew/bin/node tests/test-scheduler.mjs`.

Test cases:
- **2 players, 1 table:** produces 1 round of singles.
- **3 players, 1 table:** produces 2v1 format, all players assigned.
- **4 players, 1 table:** produces doubles.
- **5 players, 2 tables:** correct format split (2v1 + singles).
- **Opponent variety:** after generating a full schedule for 6 players, every pair has been opponents at least once.
- **No sit-outs:** every round assigns all players exactly once.

### Project Setup

- Git init with `.gitignore` (ignoring `.superpowers/`).
- GitHub repo created via `gh repo create`.
- CLAUDE.md with build/test/run instructions.
- GitHub Pages deployment from main branch.
