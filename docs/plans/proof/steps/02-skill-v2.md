# 02 Skill v2 and dev runs

## Goal
The agent reads each open check's MASTG text before it answers, ties
every NO FINDING to files it read, and the summary shows each FAIL once
per finding. Proven on the example app and its clean twin with the
free proxy (step 01) before any held-out run.

## Do
1. `report_skeleton` with a `group`: a top-level `testText` map, one
   entry per pending check ID: the sections that decide a verdict
   (tests: Overview, Evaluation; weaknesses: Overview, Modes of
   Introduction), each with its URL. Text budget per call (60k chars);
   IDs past it go in `testTextOmitted` (use `get_check`). Every ID
   returned is `markServed`, so its depth becomes "test text". Without
   a group: no text, a `testTextHint` to call per group. `buildReport`
   stays text-free (write_report rebuilds it).
2. Fills: an agent NO FINDING with empty `filesInspected` is rejected
   in code ("list the files you read").
3. Summary: FAIL rows grouped by finding (first evidence file:line),
   one line per finding with its check IDs.
4. Skill v2 (`prompts/ward-check/SKILL.md`, a prompt change): one
   `report_skeleton` call per MASVS group; judge by the `testText`
   Evaluation; NO FINDING names the files read and what was looked for
   in them; one finding may answer several checks; FAILs listed by
   finding. `npm run prompts:sync`, server 0.11.0, `plugin:build`.
5. Dev runs (asked first): example app and clean twin with
   `npm run eval:run -- --app planted|clean --setup ward-check`, then
   `npm run eval:proxy`. Iterate on the skill until the gate passes
   (test-text share ≥ 80%). Results in docs/measurements.md.

## Not in scope
Held-out runs, batch-2 labels (step 03), prompt-injection work.

## Eval
Prompt change (the skill). The before score is v1's proxy baseline
(step 01: test-text share 0%); the after score is the dev runs' proxy.

## Cost
Dev runs on Karlo's plan, about 1 to 4 `claude -p` runs (2 per
iteration). Asked before running.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: testText per group within budget, omitted IDs, served marks,
  no text without a group; NO FINDING without files rejected; grouped
  FAIL summary.
- `npm run plugin:build` run and `plugin/` committed.
- Proxy gate passes on a dev run; numbers in docs/measurements.md.
