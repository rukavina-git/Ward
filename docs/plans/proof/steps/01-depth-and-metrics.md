# 01 Depth marking, proxy metrics, strict scoring

## Goal
Make "how deep did Ward look" visible and countable, for free, before
skill v2 changes anything. Every number here comes from code and saved
runs; no new eval runs.

## Do
1. Report schema: each check gets `depth`: `analyzer` (Ward's code),
   `index` (follows from the index: placeholder, dynamic-only, no
   test), `test text` (the agent answered after Ward served it that
   check's text), `title only` (the agent answered without it), or
   null while pending. `counts.depth` counts them. Optional fields, so
   v1 reports still parse.
2. MCP server: a per-process log of the IDs whose text Ward served
   (`get_check` now; the skeleton in step 02). `write_report` sets
   `depth` from it, in code. The summary gets a depth line.
3. `evals/src/proxy.ts` and `npm run eval:proxy -- <run dirs>`: per
   run, Ward tool calls by name, agent answers, share with test text
   (from `depth`, or from the transcript's `get_check` calls for v1
   reports), agent NO FINDINGs without evidence or files read, and on
   the example app NO FINDINGs on a planted issue's MASTG test (false
   NO FINDING). Gate: test-text share ≥ 80%.
4. Held-out scorer: strict found (a labelled-found case whose case
   findings include a FAIL) next to lenient, in the arm tables. Rules
   in `evals/scoring.md`, committed before any v2 run.
5. Baseline: the proxy on skill v1's runs (example-app smoke, held-out
   10) and v1 strict re-scored; both in docs/measurements.md.

## Not in scope
Skill or prompt changes, test text in the skeleton (step 02), new runs.

## Eval
No retrieval, chunking, prompt or model change. Proxy and re-scoring
read saved transcripts only.

## Cost
None.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: depth for each kind of row, served log via get_check, counts,
  summary line; proxy on a tiny transcript and report; strict vs
  lenient tally.
- `npm run plugin:build` run and `plugin/` committed.
- v1 baseline numbers recorded.
