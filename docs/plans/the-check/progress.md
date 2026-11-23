# Plan 5 progress

- [x] 01 hardening: MASWE on verdicts, output cap, false NO FINDING → MANUAL
- [ ] 02 report schema and report_skeleton
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
