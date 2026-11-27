# Held-out, arm `ward-check`

<!-- gate:start (written by npm run eval:score-heldout) -->
Runs: 10 of 28 cases (batch 1: 10, batch 2: 0). Model: claude-sonnet-5-5.

All labels set.

| Metric | Result | Bar |
| --- | --- | --- |
| Found (lenient) | 5 of 10 (HO-01, HO-02, HO-04, HO-09, HO-10) | room ≤ 7, rethink ≥ 9 |
| Found (strict: a FAIL on the case) | 2 of 10 (HO-04, HO-10) | main number from Plan 6 (evals/scoring.md) |
| Strict, batch 1 / batch 2 | 2 of 10 / 0 of 0 | |
| Strict, without AI-co-authored fixes | 2 of 10 | |
| Harder kinds missed | 2 (HO-03, HO-08) | room ≥ 2, rethink 0 |
| Decoys flagged | 0 | rethink ≤ 1 |
| Wrong citations | 0 of 243 (0 ungraded) | room ≥ 2, rethink ≤ 1 |

**Batch 1 bar outcome: room** (found 5 of 10 (7 or fewer); missed 2 harder-kind cases (2 or more)). The Plan 6 bar for all cases is in evals/held-out-v2-bar.md.

Other findings: 0 real, 0 defensible, 0 wrong, 88 ungraded.

| Case | Kind | Result | Findings | Files read | Seconds | $ (API-eq.) |
| --- | --- | --- | --- | --- | --- | --- |
| HO-01 | config | found (lenient) | 13 | 29 | 167 | 0.79 |
| HO-02 | config | found (lenient) | 9 | 26 | 133 | 0.66 |
| HO-03 | absence | missed | 12 | 35 | 189 | 0.74 |
| HO-04 | dependency | found (strict) | 11 | 16 | 89 | 0.37 |
| HO-05 | code | missed | 8 | 23 | 51 | 0.20 |
| HO-06 | code | missed | 6 | 19 | 148 | 0.69 |
| HO-07 | code | missed | 13 | 18 | 129 | 0.62 |
| HO-08 | absence | missed | 9 | 97 | 172 | 0.75 |
| HO-09 | config | found (lenient) | 12 | 23 | 180 | 0.71 |
| HO-10 | config | found (strict) | 4 | 11 | 153 | 0.63 |

Total API-equivalent $6.16 (plan, not billed).
<!-- gate:end -->

## Note (hand-written)

`/ward:check`, skill v1, one run per case, read against
`evals/held-out-ward-check.md` (committed before the runs). Labels
proposed by Claude, confirmed by Karlo on 2026-11-24 (lenient reading
for HO-01, 02, 09; all citation proposals accepted).

- **Found 5 of 10** (`alone`: 3). Only 2 are clear: FAILs on the exact
  line for HO-04 (jackson-core, via the `dependencies` analyzer) and
  HO-10 (WebView debugging). HO-01, HO-02 and HO-09 count as found only
  leniently, the way the gate counted `alone`'s HO-01. Each is an
  analyzer MANUAL row that names the right line ("check each exported
  activity", "check the backup rules"). Strictly, 2 of 10.
- Missed, as with `alone`: all three code cases (HO-05, 06, 07) and both
  absences (HO-03, HO-08). The agent never called `get_check` or
  `search`. It judged checks by their titles.
- **Wrong citations 0 of 243** (`alone`: 25 of 83). The IDs come from
  Ward's index, so this is by construction.
- Decoys: 2 place matches, both inside the same MANUAL lists of every
  exported activity. These are proposed as not flagged, because MANUAL
  means "a human should look".
- By the pre-registered reading, 5 vs 3 is noise (6 or more would be a
  clear sign). The bar says **room**.
- 5 runs first failed the isolation check. The agent had grepped
  Claude Code's saved copy of Ward's own `report_skeleton` answer, which
  was too big to show inline. HO-08 also wrote a 1-line
  `.ward/fills.json.note`. The check was fixed and the saved transcripts
  re-checked (`npm run eval:recheck`, Karlo's OK, no reruns). The old
  failures are kept in each `meta.json` under `recheck`.
- Cost: 1.5–3 min and $0.20–0.79 per case, $6.16 in total (`alone`:
  $1.87).
