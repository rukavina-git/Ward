# Held-out gate (batch 1)

<!-- gate:start (written by npm run eval:score-heldout) -->
Runs: 10 of 10 cases. Model: claude-sonnet-5-5. Key v1.

All labels set.

| Metric | Result | Bar |
| --- | --- | --- |
| Found (lenient) | 3 of 10 (HO-01, HO-09, HO-10) | room ≤ 7, rethink ≥ 9 |
| Found (strict: a FAIL on the case) | 2 of 10 (HO-09, HO-10) | main number from Plan 6 (evals/scoring.md) |
| Harder kinds missed | 4 (HO-02, HO-03, HO-04, HO-08) | room ≥ 2, rethink 0 |
| Decoys flagged | 0 | rethink ≤ 1 |
| Wrong citations | 25 of 83 (0 ungraded) | room ≥ 2, rethink ≤ 1 |

**Outcome: room** (found 3 of 10 (7 or fewer); missed 4 harder-kind cases (2 or more); 25 wrong citations (2 or more)).

Other findings: 0 real, 0 defensible, 0 wrong, 53 ungraded.

| Case | Kind | Result | Findings | Files read | Seconds | $ (API-eq.) |
| --- | --- | --- | --- | --- | --- | --- |
| HO-01 | config | found (lenient) | 5 | 5 | 22 | 0.15 |
| HO-02 | config | missed | 5 | 11 | 48 | 0.25 |
| HO-03 | absence | missed | 4 | 5 | 21 | 0.19 |
| HO-04 | dependency | missed | 7 | 7 | 36 | 0.17 |
| HO-05 | code | missed | 5 | 9 | 35 | 0.19 |
| HO-06 | code | missed | 1 | 7 | 24 | 0.13 |
| HO-07 | code | missed | 8 | 8 | 35 | 0.17 |
| HO-08 | absence | missed | 6 | 4 | 51 | 0.28 |
| HO-09 | config | found (strict) | 7 | 7 | 32 | 0.14 |
| HO-10 | config | found (strict) | 9 | 5 | 27 | 0.19 |

Total API-equivalent $1.87 (plan, not billed).
<!-- gate:end -->

## Note (hand-written)

Outcome: **Ward has room** (all three room rules fire). Labels proposed by
Claude, accepted by Karlo on 2026-11-23.

- Asked "is it ready to publish?", Claude Code alone (Sonnet 5.5) read 4
  to 11 files per repo, under a minute each, and found 3 of 10 real
  fixes. HO-01 counts through a generic "exported components" finding
  that lists the right line; strictly it would be 2.
- It missed every code case (path traversal twice, a URL prefix check)
  and 4 of 7 harder kinds: a library manifest (HO-02), two absences
  (HO-03, HO-08) and a vulnerable dependency (HO-04).
- 18 of 19 MASWE IDs it cited name a different weakness in MASWE v1.0.0
  (e.g. logging as 0001, which is 0005; backup as 0004, which is 0006).
  MASVS controls were mostly right (57 of 64).
- Limits: 10 cases, one trial, one model, labels by Claude. Ward's
  planned analyzers cover HO-02 and HO-04 directly; the rest need Ward to
  make the agent read deeper, which is not shown yet.

Karlo's decision (2026-11-23): continue with Ward (step 03 onward).
Other findings (53) are listed in grades.json, not graded in this pass.
