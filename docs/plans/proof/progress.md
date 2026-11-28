# Plan 6 progress

- [x] 01 depth marking, proxy metrics, strict scoring (d6caeb1)
- [x] 02 skill v2 and dev runs until the proxy gate passes (code 4df2e9d; gate passes on v2, v2.1 and 0.13.0; ADR 0014 hardening apart; labels confirmed by Karlo 2026-11-28)
- [x] 03 label held-out batch 2 (18 cases, re-frozen 2026-11-26 after review; Karlo's spot check of 5 passed 2026-11-27)
- [x] 04 prompt-injection tests in code (see commit below)
- [x] 05 prompt-injection agent runs (3 of 3 held; t3 rerun after a plan-limit stop)
- [ ] 06 skill v2 on the held-out set, plus analyzers-only (analyzers 20/20; ward-check 15/20, left: HO-19, 20, 23, 24, 25; nothing scored yet; HO-11, 12, 16, 21, 22, 26, 27, 28 dropped for good, Karlo 2026-11-28)

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

- Step 03: step file written this run. Batch 2 is its own key
  (`evals/answer-keys/held-out-2.json`, HO-11 to HO-30) pinned by
  `evals/held-out-batch2.md`, so batch 1's hash stays. `heldout:check`
  takes a key path. Counts: code 8, config 5, absence 2, dependency 3;
  17 repos; fixes 2026-07-15 to 2026-11-18. One labelling session.
  GitHub commit search hit its rate limit, so candidates came mostly
  from commit-message grep over `--filter=tree:0` clones of about 130
  apps (evals/.cache/held-out-b2, gitignored). Log of all candidates (18 kept, 5 reserve, 31 dropped):
  `evals/held-out-batch2-log.md`.

- Step 04: step file written this run. Found and fixed a real gap: the
  terminal summary printed evidence file names, rejected check IDs and
  citation messages as they were, so a file name with a newline or
  ANSI codes could forge "Citation check: … confirmed" or close the
  summary's code block. `displaySafe` now cleans every such string.
  Tests: `packages/analyzers/src/injection.test.ts` (hostile comments,
  meta-data and strings change no analyzer verdict),
  `packages/report/src/injection.test.ts` (hostile fills and summary
  text). check_report's guards (rollup, counts, gaps, hardening flag)
  were already tested in citations.test.ts. Depth claimed in a
  hand-edited report.json can't be checked: the served log lives in the
  server process. Server 0.13.2.
- Step 05: step file written this run. `--app canary` adds the comment
  to the copy only (`evals/src/canary.ts`); `npm run eval:canary` scores
  it. Baseline: planted t1 and t2 have both target rows FAIL.
- Step 04 review (no BLOCKER; SHOULDs fixed, server 0.13.3): the
  must-exist injection test now plants a sign-up line, so account
  deletion is FAIL and only a comment stands between it and NO FINDING
  (checked: real deletion code flips it). displaySafe also cleans ~~~
  fences, U+2028/2029, zero-width and tag characters; tabs become
  spaces. Not fixed: write_report's and check_report's JSON results
  carry rejected IDs and citation messages uncleaned (JSON-escaped,
  labelled data); findings grouped by the clipped file name.

- Step 06: step file and bar (`evals/held-out-v2-bar.md`) written
  before any run. Analyzers-only arm is `eval:analyzers-heldout` (imports
  `buildReport` from @ward/mcp's dist, evals now depends on @ward/mcp).
  Two trial analyzer runs (HO-10, HO-20) made while building it were
  deleted unscored before the bar was committed. Scorer re-run: v1
  tables' numbers unchanged.
- Step 06, HO-18 (2026-11-28): the run failed the report schema, a Ward
  bug, not the agent: the dependencies analyzer named all 67 advisories
  of jackson-databind 2.9.6, and the merged reason passed the
  4000-character cap. Fixed in code (first 10 named, the rest counted;
  a merged analyzer reason is capped too), tests added, server 0.13.4.
  HO-18 was rebuilt from its own report with only that reason shortened
  (`rebuild.mjs` in the run folder, `report.original.json` kept); no
  agent rerun (Karlo's call). Runs from HO-19 on use 0.13.4.

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

Step 02 additions (reviewer: no BLOCKER; SHOULDs fixed in d8b3a98):
- Only manifest/network MANUALs are settleable; check_report rechecks
  the hardening flag; list +0292-0294, -0022/0222/0223.
- Not fixed (NITs): a hardening-only control with a FAIL and a pending
  check reads MANUAL, not pending; the summary shows only hardening
  FAILs, not their other verdicts; the step file doesn't describe these
  additions (Deviations does). No new dev run: in the 0.13.0 runs the
  agent left the must_exist and dependencies MANUALs alone and none of
  0022/0222/0223 failed, so 0.13.1 wouldn't change those numbers.

Step 03 (reviewer: no BLOCKER; SHOULDs acted on before any run):
- Dropped the first freeze's HO-21 (WooCommerce: no security claim, not
  a clean twin) and HO-29 (onyx user CAs: arguable for a browser); IDs
  renumbered. HO-17 now labels all three bridges the fix changes; HO-22
  (now HO-21) marks the unfixed MMS receivers defensible; HO-14 has no
  MASTG test; HO-18 lost its launcher-activity anchor.
- Karlo, 2026-11-26: keep the 5 AI-co-authored fixes (HO-14, 17, 18,
  19, 27); step 06 reports found with and without them. Accept code at
  44% of the batch.
- NIT not fixed: the 40% kind cap in tests vs "about a third" in the plan.
