# Sit-outs & 2v1 Toggle

## Problem

The table stepper enforces a minimum of `ceil(players/4)` tables, preventing users from choosing fewer tables than needed to seat everyone. In real scenarios (e.g. 10 players but only 2 tables available), some players should sit out and rotate. Additionally, 2v1 format is sometimes unwanted — users need a toggle to disable it.

## Requirements

1. **No minimum table count.** Table stepper min becomes 1, regardless of player count. Max stays at `floor(n/2)`.
2. **Sit-out rotation.** When `players > table capacity`, some players sit out each round. Sit-outs rotate evenly — each player sits out roughly the same number of times (`max - min <= 1`).
3. **Bench display.** Each round card in the schedule view shows "Sitting out: [player pills]" below the tables.
4. **2v1 toggle.** A checkbox below the table stepper, labeled "Allow 2v1", default checked. When unchecked, no 3-player tables are generated — odd remainders produce a sit-out instead.
5. **Summary text updates.** When sit-outs will occur, the summary shows e.g. "6 players x 1 table -> doubles (2 sit out per round)".

## Design

### State changes

- Add `state.allow2v1` (boolean, default `true`)
- No new state for sit-outs — computed during generation

### `decideTableFormats(playerCount, tableCount, allow2v1)`

New third parameter. When `allow2v1 === false`, reject any combination that includes a 3-player table. The function returns formats for the players who play; the caller computes `sitOutCount = totalPlayers - sum(formats)`.

When `playerCount > tableCount * 4` (not enough tables for everyone), the function still returns the best format for the given table count — e.g. 8 players, 1 table -> `[4]` (doubles, 4 sit out).

When `allow2v1 === false` and player count is odd (e.g. 5 players, 3 tables), one player will always sit out since you can only seat 2 or 4 per table and 5 has no valid partition into 2s and 4s. The function returns the best fit (e.g. `[2,2]` = 4 players, 1 sits out) even if more tables are available.

Existing behavior is preserved when `allow2v1 === true` and tables are sufficient.

### Sit-out wrapper in `generateSchedule`

`generateSchedule` gains an `allow2v1` parameter.

1. Compute `formats = decideTableFormats(n, tableCount, allow2v1)`
2. `capacity = sum(formats)`. If `capacity >= n`, proceed as today (no sit-outs).
3. If `capacity < n` (sit-out mode):
   - `sitOutCount = n - capacity` per round
   - Maintain `sitOutCounts[i]` tracking total sit-outs per player
   - Each round: select the `sitOutCount` players with the most games played (lowest sit-out count), breaking ties randomly
   - Call existing scheduling logic with the active subset and the formats array
   - Attach `round.sittingOut = [...]` (player objects) to each round
   - Use opponent/partner matrices indexed by the full player list so history accumulates across rounds
4. Sit-out mode always uses the round-by-round greedy path (not circle method), since each round has a different player subset.

### Round stopping

Same as today: stop when all active-player opponent pairs have met, or `maxRounds = 20`. With sit-outs, "all pairs met" means all pairs among the full player list, which may take more rounds since not everyone plays every round.

### UI: Setup view

- Table stepper: `minTables = 1` always. Remove `ceil(n/4)` floor.
- 2v1 toggle: checkbox below table stepper, "Allow 2v1", default checked. Stored in `state.allow2v1`.
- Summary text: when `sitOutCount > 0`, append "(N sit out per round)".

### UI: Schedule view

- Each round card: if `round.sittingOut.length > 0`, render a "Sitting out:" line with greyed-out player pills below the table assignments.

## Testing (TDD)

All logic changes must be test-driven: write failing test first, then implement.

### Unit tests

- `decideTableFormats` with `allow2v1=false`: 5p/2t -> `[2,2]`, 7p/3t -> `[2,2,2]`, 7p/2t -> `[4,2]`
- `decideTableFormats` with `allow2v1=true`: existing tests unchanged (backward compat)
- `decideTableFormats` with fewer tables: 8p/1t -> `[4]`, 10p/2t -> `[4,4]`
- Sit-out fairness: 6p/1t schedule -> all players sit out 2 or 3 times, `max - min <= 1`
- Sit-out correctness: `round.sittingOut` has correct count, no player appears both on table and sitting out
- No sit-outs when capacity >= players: 4p/2t has no `sittingOut` entries
- All existing quality sweep tests still pass

### UI tests

- 2v1 toggle visible and default checked
- Toggling 2v1 off updates summary text
- Table stepper goes to 1 with 8 players (no min enforcement)
- Sit-out display: 6p/1t shows "Sitting out" in schedule view
- Player pills in sit-out list are present
