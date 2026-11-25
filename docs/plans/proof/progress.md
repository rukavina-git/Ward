# Plan 6 progress

- [x] 01 depth marking, proxy metrics, strict scoring (d6caeb1)
- [ ] 02 skill v2 and dev runs until the proxy gate passes (code 4df2e9d; gate passes on v2, v2.1 and 0.13.0; ADR 0014 hardening apart; Karlo to confirm proposed labels)
- [ ] 03 label held-out batch 2
- [ ] 04 prompt-injection tests in code
- [ ] 05 prompt-injection agent runs
- [ ] 06 skill v2 on the held-out set, plus analyzers-only

## Deviations
- Step 01: plan folder and step file written this run. Depth is set in
  `write_report` (`markDepth` after `applyFills`), not in the skeleton,
  so the skeleton's size doesn't grow. The served log is per server
  process (`packages/mcp/src/served.ts`). Strict found is a proposal
  derived from the lenient label plus a FAIL candidate, with its own
  `strict.label`. `write_report`'s tool description now names the depth
  rule (tool text, not a prompts/ file). Server 0.10.0. The key schema
  keeps `mastg` (it was in the JSON, dropped by the parser).

- Step 02: step file written this run. Text sections are Overview and
  Evaluation (tests), Overview and Modes of Introduction (weaknesses);
  Steps/Observation left out (they describe binary tooling). The
  per-group text budget is 60k chars; the biggest group on the example
  app (STORAGE) is about 62k chars of JSON in all, about 16k tokens.
  `write_report` is called once for the whole scope, not per group.
  Server 0.11.0.

- Step 02 additions (2026-11-25): skill v2.1 lets the agent settle an
  analyzer MANUAL (server 0.12.0); ADR 0014 reports hardening checks
  apart without a profile and the eval skips them (0.13.0). Planted
  dev run on 0.12.0 deleted: `eval:run` rebuilds Ward at start, so it
  picked up half-done code. Don't edit code while a run is starting.

## Gotchas
Carried over: see docs/plans/the-check/progress.md.

Step 01 (reviewer: no BLOCKER; not fixed):
- SHOULD: `provisional` ignores `strict.label`, so gate.md and
  ward-check.md say "All labels set" while every strict label is a
  proposal. Add `unlabelled(g.strict)` for lenient-found cases, or a
  "strict: proposals" note. Karlo should check the 4 strict proposals.
- NITs: the proxy's transcript fallback counts `get_check` calls that
  returned `found: false` or were cut off; the served log has no order
  or project (a `get_check` after the fills still gives "test text");
  the Depth summary line leaves out the `index` count.

Step 01:
- v1 baseline: test-text share 0% everywhere; strict Ward 2/10 = alone
  2/10. Step 02's dev runs need a transcript (run them via
  `npm run eval:run -- --app planted --setup ward-check`), then
  `npm run eval:proxy`.
- Step 02 pushes test text into the skeleton: it must call
  `markServed` for each check whose text it returns, or depth stays
  "title only". Mind the 20k-token cap: one group per call.

Step 02 (reviewer: no BLOCKER; not fixed):
- SHOULD: FAILs with no evidence left (citation checker dropped it)
  all share one summary line `no evidence  A, B, …`. Key them by
  check ID instead, with a test.
- NITs: no test for a weakness's testText sections; testText key and
  markServed use `record.id`, not the pending ID (alias risk); a
  NO FINDING without files on an unknown or owasp row gets the
  "list the files" message instead of the real reason; one long doc
  comment line in fills.ts.
- Dev runs: `npm run eval:run -- --app planted --setup ward-check
  --model <id> --trial <n>` (both flags required) and `--app clean`,
  then `npm run eval:proxy -- <run dirs>`. Gate:
  test-text share ≥ 80%. Record both in docs/measurements.md.
- Runner fix: `must_exist` was missing from the ward and ward-check
  setups' expected tool lists, so every run since Plan 5 step 06
  failed isolation. Fixed; the planted v2 run rechecked to ok.
- Planted v2 run: 10 findings ungraded (score is provisional); EA-03
  got a NO FINDING despite the test text.
