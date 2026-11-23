# 02 Claude alone on the held-out set (the gate)

## Goal
A minimal, cheap gate: run Claude Code alone once on each of the 10
frozen held-out cases (batch 1), on Sonnet 5.5, and score it against
`evals/held-out-bar.md`. Karlo decides: stop Ward, run more, label
batch 2, or go on. No Ward code is written in this step.

(Changed 2026-11-23, Karlo: minimal gate to save plan usage. The first
draft had 60 runs on two models; cut to 10.)

## Do
1. Bar for the minimal gate, committed on its own before any run:
   Sonnet 5.5, one trial, parent commits only. Settles the step 01
   reviewer points: "harder kinds" named honestly, "room" wins when both
   fire, verdicts-per-control dropped for this pass. Key stays frozen.
2. Runner: `npm run eval:run` gets `--heldout HO-NN` as an alternative
   to `--app`. It exports the case's parent commit from the blobless
   cache (`evals/.cache/held-out`, made by `heldout:check`) with
   `git archive` (argument list, no shell) into a fresh temp folder
   named `app`. No `.git`: the history contains the fix. Same task
   prompt, schema, tools and isolation as the baseline, arm `alone`.
   meta.json records case, commit, key version and the bar's sha256.
   Default timeout 60 min. Results in `evals/results/held-out/`
   (transcripts stay local, gitignored).
3. First run: HO-10 (aard2, smallest repo). It counts. Stop and report
   minutes, tokens and how much of the 5-hour Pro window it used;
   Karlo says whether to do the other 9, and how fast.
4. The other 9 runs, spread as Karlo says.
5. Scorer `npm run eval:score-heldout`: proposes matches the bar's way
   (anchor file, within 10 lines; for `absence`, the right file or
   component) into `grades.json` as `proposed` labels; nothing counts
   until Karlo sets `label`. Citation IDs checked against the pinned
   index automatically. Writes `gate.md` with each bar metric, the
   outcome, misses by case and kind, files inspected, minutes, tokens.
   The note below is hand-written: Karlo's decision.
6. Tests (Vitest, offline): the export has no `.git` and only the
   commit's files (tiny local test repo); the ±10-line matching rule;
   the bar's outcome on made-up grades (room, rethink, in between,
   both firing).

## Not in scope
- Opus runs, second trials, fix-commit runs (only if Karlo asks later).
- Any Ward check, analyzer, MCP tool or plugin arm (steps 03 onward).
- Labelling batch 2.
- Changing the answer key; changing the bar after the first run.

## Cost
Plan usage only, not money (ADR 0007). 10 runs. The first run measures
the real usage before the rest.

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- 10 runs ok (failed attempts kept, rerun as `-a2`), every grade
  labelled by Karlo, `gate.md` states the outcome and Karlo's decision,
  also in progress.md.
- Roadmap "Held-out eval set" ticked. Glossary has: gate (go/no-go),
  tree export (git archive).
