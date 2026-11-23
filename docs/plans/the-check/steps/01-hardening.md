# 01 Hardening

## Goal
Make the analyzers safe to build a report on: every verdict names its
MASWE weaknesses from the pinned index, no tool answer is too big for
Claude Code, and the known ways an analyzer could say NO FINDING while
something is wrong give MANUAL instead. Downgrades only; no parser
rewrites.

## Do
1. MASWE on every verdict. The MCP layer (`runAnalyzer`) adds `maswe`
   to each verdict: the union of what the analyzer set and the
   weaknesses the index links to its MASTG tests. Analyzers stay free
   of the index. Test: every verdict on the example app has at least
   one MASWE ID, each an active record in the index.
2. Trim `dependencies` output (the tool, not the analyzer): the
   `dependencies` list keeps release-scope facts only; test, debug and
   build-time ones become counts (`notJudged`). Unresolved release
   declarations stay in the MANUAL verdict's evidence.
3. Output cap test: each analyzer tool on both fixtures, and the
   knowledge tools (full checklist, a get_check, a search), stay under
   20k tokens (estimated as JSON characters / 4).
4. False NO FINDING → MANUAL (plan 4 Gotchas):
   - `gradle.ts`: isDebuggable that is not a literal in the variant's
     build type, or set for it from outside its block
     (`getByName("release").isDebuggable`, `release.isDebuggable`,
     `all {}`, `configureEach {}`), is recorded as unresolved; the
     debuggable check is then MANUAL unless another fact says FAIL.
   - `network.ts`: when the NSC file exists in more than one source set
     of the app module and the copies differ, NO FINDING becomes MANUAL
     (a flavor's copy may win).
   - `network.ts`: user CAs trusted in debug-overrides give NO FINDING
     only if the debuggable check says NO FINDING; else MANUAL.
   - `dependencies.ts`: multi-line `include(...)` in settings is read.
     `add("implementation", …)` and kts `"implementation"(…)` lines
     are listed as unrecognised release declarations (so MANUAL).
   - `osv.ts`: an index with fewer than 1,000 advisories is treated as
     unavailable (MANUAL). A failed cache write keeps the downloaded
     index and reports the problem.

## Not in scope
Walk-cap and per-module manifest disagreements (step 04 Gotchas),
BOM resolution, the report schema (step 02).

## Eval
No retrieval, chunking, prompt or model change: no eval run.

## Cost
None. No LLM calls.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Each item above has a test that failed before the change.
- MCP server version bumped (0.5.0).
