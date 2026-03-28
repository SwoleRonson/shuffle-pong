# Algorithm Design Decisions

Architectural decisions and trade-offs in the scheduling algorithm.

## Partner Coverage Stopping Condition

**Decision:** Generate rounds until all opponent AND partner pairs are covered, not just opponents.

**Context:** With 5 players and 2 tables (formats [3,2]), only 1 partnership slot per round (the 2-player side of 2v1). C(5,2)=10 unique pairs need 10 rounds. The original opponent-only stopping condition stopped at ~5 rounds, leaving many partner pairs unmet.

**Trade-off:** More rounds generated (e.g. 10 instead of 5 for 5p/2t), but players want maximum variation and play as many rounds as time allows. Groups that stop early still get good quality — the algorithm frontloads opponent variety.

**Guard:** All-singles formats skip the partner check (no partnerships exist). The 20-round cap prevents explosion for configs where full coverage is infeasible.

## Solo Streak Fairness

**Decision:** Add `soloCost` to round assignment scoring at equal weight with opponent and partner costs.

**Context:** With 5p/2t, one player would play solo (singles or solo side of 2v1) for many consecutive rounds. The algorithm frontloaded partnerships, then dumped one player to singles repeatedly.

**Alternatives tested:**
1. Solo cost at `bestSplit` level only — made things *worse* (avg streak 5.3 → 5.9) because bestSplit only affects who's the "1" in 2v1, not who goes to the singles table.
2. Solo cost at partition level with 100x weight — modest improvement (5.3 → 4.9) but distorted other quality metrics.
3. Solo cost at partition level with equal weight — best result (5.3 → 3.7 avg, theoretical minimum is 2.0).

**Insight:** Opponent/partner costs are already 0-1 for good partitions, so solo cost at 1x naturally breaks ties without distorting the primary quality metrics.

## Partner Repeat Tolerance

**Decision:** Allow `maxPartnerCount <= 2` (was `<= 1`) for configs with extended schedules.

**Context:** Some configs (e.g. 6p/2t with 16 partnership slots for 15 unique pairs) unavoidably repeat one partnership when generating enough rounds for full partner coverage. The scoring heavily penalises repeats (`parMax * 10000`) to keep this minimal.

**Trade-off:** A single repeated partnership is acceptable because the user gets full opponent and partner coverage in exchange. Playing the same person twice with different opponents on the table is much less noticeable than having the same partnership twice.

## Candidate Scoring Formula

```
candidateScore = parMax * 10000 + oppMax * 1000 + parSqSum * 10 + oppSqSum
```

**Priority order:** Minimise max partner repeats first, then max opponent repeats, then partner evenness, then opponent evenness. This ensures the greedy multi-candidate approach selects schedules with the least repeated pairings overall.
