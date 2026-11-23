# 05 Ward on the held-out set

## Goal
Run `/ward:check` once on each of the 10 held-out cases and score it the
same way as the gate's `alone` run. Answers "does Ward's report find
what Claude alone missed, with right IDs", not "by how much" (Plan 6).

## Do
1. Eval arm `ward-check` in `evals/src/setups.ts`: the repo's `plugin/`
   (skill `/ward:check`), Ward's MCP server with all its tools, and
   Write on top of Read, Grep, Glob, Skill (the skill writes
   `.ward/fills.json`). Prompt `/ward:check`, no findings schema. Same
   model, isolation and exported commits as `alone`. A Write outside
   `.ward/` fails the run.
2. `evals/src/report-findings.ts`: Ward's `.ward/report.json` → the
   findings format, in code. One finding per check ID whose rows carry
   evidence (FAIL, or another verdict with evidence), its controls as
   `masvs`, its MASWE IDs, evidence file:line as locations. Rows without
   evidence have no place to score and are left out (counted in meta).
3. The runner copies `.ward/report.json` and `fills.json` into the
   result folder, converts, validates and writes `findings.json`; the
   held-out scorer then works unchanged and writes `ward-check.md`.
4. `evals/held-out-ward-check.md`: what is compared and how it is read,
   committed before the first run.
5. With Karlo's OK: one smoke run on the example app (not held out),
   then 10 runs, Sonnet 5.5, trial 1. Labels proposed by Claude, set by
   Karlo. Record in docs/measurements.md.

## Not in scope
Changing the skill or prompts (one run per skill version; skill v1),
more trials, Opus, fix commits, batch 2.

## Eval
This is the eval. No retrieval, chunking or prompt change.

## Cost
11 `claude -p` runs on Karlo's plan, Sonnet 5.5: about 16 points of
the 5-hour window (~$1–3 API-equivalent each, not billed). Asked first.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: converter (FAIL with evidence, evidence-less row skipped, one
  check under two controls merged, subfolder prefix, inspected files),
  buildArgs without a schema and with extra tools, isolation on Write.
- Pre-registration committed before the first held-out run.
- 10 runs scored (or deferred by Karlo); `ward-check.md` and
  measurements updated.
