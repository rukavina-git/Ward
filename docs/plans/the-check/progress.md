# Plan 5 progress

- [x] 01 hardening: MASWE on verdicts, output cap, false NO FINDING → MANUAL (1d4b9a7)
- [x] 02 report schema and report_skeleton (HASH)
- [ ] 03 citation checker
- [ ] 04 skill and /ward:check
- [ ] 05 Ward on the held-out set
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
