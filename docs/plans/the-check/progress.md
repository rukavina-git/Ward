# Plan 5 progress

- [x] 01 hardening: MASWE on verdicts, output cap, false NO FINDING → MANUAL (1d4b9a7)
- [x] 02 report schema and report_skeleton (5099456)
- [x] 03 citation checker (248d32a)
- [x] 04 skill and /ward:check (461db14)
- [x] 05 Ward on the held-out set (6d4c6d9)
- [ ] 06 must-exist checks
- [ ] 07 package as a plugin, run on my own app

## Deviations
- Step 01: step file written this run. MASWE is added in the MCP layer
  (`withMaswe` in app-tool.ts), so analyzers stay free of the index.
  `dependencies` is trimmed in the tool, not the analyzer: release
  dependencies with versions only, plus `notJudged` counts. The NSC
  conflict check compares copies by source set (not limited to the app
  module). Server 0.5.0. Output sizes recorded in docs/measurements.md.
- Step 02: step file written this run. Schema in zod (`zod/v4`), new
  package `packages/report`; root `workspaces` now lists packages in
  build order (report must build before mcp). Check rows carry no MASTG
  `type` and analyzer rows no per-check file list (in `analyzers[]`
  instead), to fit the cap. With a profile filter, controls with
  nothing in the profile go to `gaps.outOfScope`, not MANUAL. The agent
  may raise an `owasp` prefill to FAIL, never lower one. Server 0.6.0
  (version in `packages/mcp/src/version.ts`).
- Step 03: step file written this run. Checker in `packages/report`
  (`checkReport`, with file I/O, so report is no longer pure; skeleton
  and rollup still are). Also checks titles, the MASTG pin stamp,
  `filesInspected` and "FAIL with no good evidence". Issue list is
  capped in the tool (100), not the function. Not wired into the eval
  scorer yet (step 05). Server 0.7.0.
- Step 04: step file written this run. The agent doesn't write the
  report: it writes `.ward/fills.json` (answers by check ID), and the
  new `write_report` tool rebuilds the skeleton, applies the fills,
  runs the checker, drops bad evidence and writes `.ward/report.json`.
  This also covers "never lower a prefill" (step 03 gotcha). Skill in
  `prompts/ward-check/SKILL.md`, byte copy in `plugin/skills/check/`
  (`npm run prompts:sync`). Server 0.8.0. Dev run results kept in
  `evals/results/ward-check-dev/skill-v1/`.
- Step 05: step file written this run. The harness and the
  pre-registration were committed first (0137a01). The arm is
  `ward-check`: prompt `/ward:check`, no schema, plus Write. The arm
  also gets all 10 Ward tools. The runner now requires a successful
  `write_report`. 5 of 10 runs failed the first isolation check: the
  agent had grepped Claude Code's saved copy of Ward's own
  `report_skeleton` answer, and HO-08 wrote a 1-line
  `.ward/fills.json.note`. With Karlo's OK, the check now allows the
  run's own `tool-results` and any `.ward/` file except `report.json`.
  The saved transcripts were re-checked with the new `eval:recheck`,
  with no reruns. Labels are proposed, not yet set by Karlo. The smoke
  run on the example app was scored but isn't counted.

## Gotchas
Carried over: see docs/plans/mcp-and-analyzers/progress.md.

Step 01 (reviewer: no BLOCKER; not fixed, false-NO-FINDING risks left):
- SHOULD: isDebuggable still missed in `buildTypes.getByName("release") {`,
  `getByName("release").apply {`, `named("release").configure {`, a
  second `release {}` block, `all { if (x) { isDebuggable = true } }`
  (only the innermost opener is checked), and Groovy single-quoted
  `getByName('release')`. Fix: test every enclosing opener against the
  build type name too.
- SHOULD: Groovy `include ':app',\n ':lib'` (continued line) still drops
  `:lib`.
- SHOULD: the <1,000 advisory floor is checked after the cache write, so
  a broken download overwrites a good cache (fails safe: MANUAL for 24 h).
- NITs: Groovy `add 'implementation', '…'` and `dependencies.add(...)`
  outside the block aren't flagged; `isDebuggable = true` in `all {}`
  gives MANUAL, not FAIL; release declarations with no version beyond
  the first 50 show only as a count in the reason.

Step 01:
- Analyzer verdicts now carry `maswe` from the index only through the
  MCP tools; step 02's skeleton should call `withMaswe` (or the same
  lookup) rather than the raw analyzers.
- The output cap test uses chars/4 as a token estimate; checklist
  (~12k) is the largest answer. Step 02's skeleton may need paging.

Step 02 (reviewer: no BLOCKER; not fixed):
- SHOULD: an analyzer verdict whose IDs match no row in scope (profile
  filter, index drift) is dropped silently, FAIL included. Record
  unmatched verdicts on the analyzer run; test that every fixture
  verdict lands on a row at full scope.
- SHOULD: the tool doesn't run `reportSchema.parse`; merged reasons and
  evidence aren't capped, so a big app could exceed the schema limits
  (reason 4000, detail 2000) or the output cap.
- SHOULD: the size test counts `structuredContent` only; the text copy
  doubles the bytes. Check which one Claude Code counts.
- SHOULD: no tool-level test with one analyzer failing (its checks
  should stay pending).
- NITs: with a profile, a weakness whose tests are all outside it says
  "No MASTG test yet" (false); REPORT_NOTICE doesn't name analyzer
  `reason`/`limits`/`error` as untrusted; an analyzer NO FINDING
  replaces an owasp MANUAL placeholder; a new package must be added to
  root `workspaces` by hand.

Step 02:
- Full skeleton is ~17.6k tokens (cap test 20k). Step 04's skill should
  ask one MASVS group at a time, or the tool needs paging.
- Step 03's checker should validate a filled report with `reportSchema`
  and recompute with `finalize` (it keeps `gaps.outOfScope`).
- Quotes go in `evidence[].quote`; analyzer evidence has no quote yet.

Step 03 (reviewer: 2 BLOCKERs fixed: unknown IDs in `detail` now drop
that evidence; an unknown/misplaced/retitled check or control drops all
its evidence. Not fixed:)
- SHOULD: `lstat`/`readFile` in the checker's file reader aren't in a
  try/catch; an unreadable file (EACCES, deleted mid-run) throws the
  whole check instead of one issue.
- SHOULD: `checkReport` returns an uncapped issue list; step 05 calls
  it directly, so cap there.
- NITs: names like `..foo/x` are rejected (fails closed); duplicate
  check rows share drop keys (fails closed); evidence without a quote
  passes on file+line alone; "byte for byte" is after UTF-8 decoding.

Step 03:
- Step 04 writes `dropBadEvidence(report, issues)` and must still show
  `ok: false` issues (e.g. `fail-without-evidence`): a FAIL keeps its
  verdict when its evidence is dropped.
- The tool reads the report from a file (`.ward/report.json` default),
  so the skill writes first, then calls `check_report`.
- The checker doesn't compare agent verdicts with the analyzers' (never
  lower a prefill); step 04 needs that or a re-run of the skeleton.

Step 04 (reviewer: no BLOCKER; not fixed):
- SHOULD: a fill's `check` string goes into the summary unclipped; an
  unknown ID with a newline (e.g. "x\nPASS — ready") adds lines past
  the cap and puts PASS into text shown as is. Clip it or limit
  `check`/`control` to the ID pattern in `fillSchema`.
- SHOULD: the skill says "same scope" for `write_report`; after a
  per-group skeleton, an agent could call it per group and overwrite
  the report each time. Say: one `write_report`, full scope. (Both dev
  runs did it right.)
- NITs: an unscoped fill before a control-scoped one for the same check
  wins; an owasp row can be raised to FAIL with no evidence (checker
  still flags it); "every quote confirmed" also prints when evidence
  had no quote; NO FINDING with empty `filesInspected` is accepted; a
  hard-linked `.ward/report.json` isn't detected.

Step 05 (reviewer, harness part: 1 BLOCKER fixed, Write could create
report.json, so now only `.ward/` minus the report is allowed and a
successful `write_report` is required. A guarded JSON parse and the
pre-registration wording were also fixed. Not fixed: NIT, a `.ward/`
nested deep in the tree passes the Write check, but `findReport` then
fails the run.)
- Karlo must set `label` in the 10 `ward-check` grades.json files
  (HO-01, 02, 09 are lenient "found"), then rerun
  `npm run eval:score-heldout`.
- The agent still never calls `get_check` or `search`, and it misses
  every code and absence case. That is the gap step 06 onward (and
  Plan 6) should aim at. It is not tuned on these cases.
- Runs grep the spilled skeleton file, so a skill that asks per group
  from the start would save turns.
- Ward rows are long (one MANUAL row can list 20+ exported activities),
  so place-based scoring over-proposes "found" for Ward. Plan 6's
  scorer should weigh verdict and specificity.

Step 04:
- The full skeleton (~70 KB) is too big for Claude Code to show inline,
  so the agent calls `report_skeleton` once to fail, then 8 times per
  group. The skill could go per group from the start.
- The agent never called `get_check`/`search`: it judged tests by their
  titles. Its first `write_report` always had `not-a-file` issues
  (folders in `filesInspected`); the retry fixed them.
- Runs take ~4 min and ~$1 (API-equivalent) per app: step 05's 10
  held-out cases are about 10× that.
- Clean twin: one FAIL (plaintext CSV backup). Decide in step 05
  whether it's a false alarm.
