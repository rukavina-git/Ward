# Held-out, arm `ward`

<!-- gate:start (written by npm run eval:score-heldout) -->
Runs: 1 of 28 cases (batch 1: 1, batch 2: 0). Model: claude-sonnet-5-5.

PROVISIONAL: some labels are still proposals. Set every `label` in grades.json, then rerun.

| Metric | Result | Bar |
| --- | --- | --- |
| Found (lenient) | 1 of 1 (HO-04) | room ≤ 7, rethink ≥ 9 |
| Found (strict: a FAIL on the case) | 1 of 1 (HO-04) | main number from Plan 6 (evals/scoring.md) |
| Strict, batch 1 / batch 2 | 1 of 1 / 0 of 0 | |
| Strict, without AI-co-authored fixes | 1 of 1 | |
| Harder kinds missed | 0 (none) | room ≥ 2, rethink 0 |
| Decoys flagged | 0 | rethink ≤ 1 |
| Wrong citations | 4 of 12 (0 ungraded) | room ≥ 2, rethink ≤ 1 |

**Batch 1 bar outcome: room** (found 1 of 10 (7 or fewer); 4 wrong citations (2 or more)). The Plan 6 bar for all cases is in evals/held-out-v2-bar.md.

Other findings: 0 real, 0 defensible, 0 wrong, 6 ungraded.

| Case | Kind | Result | Findings | Files read | Seconds | $ (API-eq.) |
| --- | --- | --- | --- | --- | --- | --- |
| HO-04 | dependency | found (strict) | 7 | 5 | 28 | 0.23 |

Total API-equivalent $0.23 (plan, not billed).
<!-- gate:end -->

## Note (hand-written)

First run of Claude Code with Ward's MCP tools (step 07). One case,
HO-04, picked by Karlo; same model, prompt and commit as the gate's
`alone` run. The bar is written for 10 runs, so its outcome line above
says nothing here; compare with the `alone` run of HO-04 instead.

- Found HO-04 (jackson-core 2.20.1, `app/build.gradle.kts:254`) via
  Ward's `dependencies` tool, with the right IDs. `alone` missed it.
- The agent called 4 analyzers (manifest, build_config, network,
  dependencies), never `search`, `get_check` or `checklist`.
- 4 of its 5 MASWE IDs are still wrong. Ward's manifest and network
  verdicts carry MASTG test IDs but no MASWE IDs, so the agent picked
  them itself. Only the dependency verdict gave MASWE-0044, and that one
  is right.
- 28 s, 13 turns, read 5 files (`alone`: 36 s, 14 turns, 7 files).
- Labels proposed by Claude; Karlo to confirm. The 6 other findings are
  not graded (as in the gate).
