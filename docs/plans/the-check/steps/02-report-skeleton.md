# 02 Report schema and `report_skeleton`

## Goal
Give the agent a form to fill instead of a checklist to recall: one
MASVS control per row, its MASTG tests nested under it, IDs and titles
copied from the pinned index, analyzer verdicts already in place. The
control verdict is computed in code (ADR 0012).

## Do
1. New package `packages/report` (ADR 0002's planned `report`): the
   report schema in zod (JSON Schema from it), the rollup, and a pure
   `buildSkeleton`. No MCP code, no I/O.
2. Schema `ward-report/1`: scope (groups, profile, variant), stamps
   (Ward version, MASTG pin, OSV date), analyzer runs (files inspected,
   limits, errors), controls → checks (MASTG test, or a MASWE weakness
   with no test) with MASWE IDs, verdict (null = pending), who set it
   (analyzer, owasp, agent), reason, evidence (file, line, detail,
   quote) and files inspected; counts; gaps (pending, manual, needs
   dynamic, out of scope).
3. Rollup: worst check wins (FAIL > MANUAL > NEEDS DYNAMIC > NO FINDING
   > N/A); any FAIL is FAIL; otherwise a pending check keeps the control
   pending; a control with no checks is MANUAL. `finalize` recomputes
   control verdicts, counts and gaps from the checks.
4. Prefill from the index: placeholder tests and weaknesses without a
   test are MANUAL; dynamic-only tests NEEDS DYNAMIC. Analyzer verdicts
   (with `withMaswe`) replace those; two on one test merge, worst wins.
   A verdict with only MASWE IDs (target SDK) lands on the weakness row.
5. MCP tool `report_skeleton` (projectRoot, variant, group, profile):
   runs the four analyzers, builds the skeleton. One analyzer failing
   leaves its checks pending; a bad root is a tool error. Server 0.6.0.

## Not in scope
The citation checker (step 03), writing `.ward/report.json` and the
skill (step 04), HTML (Plan 8).

## Eval
No retrieval, chunking, prompt or model change: no eval run.

## Cost
None. No LLM calls.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: rollup rules; skeleton on synthetic input; the tool on both
  fixtures (24 controls, every ID in the index, planted issues FAIL,
  clean twin no FAIL, group and profile scope); full skeleton under
  20k tokens on both fixtures.
