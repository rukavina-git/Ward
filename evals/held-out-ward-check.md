# Held-out, arm `ward-check`: what is compared (batch 1)

Written 2026-11-23, before any `ward-check` run on the held-out set
(plan 5, step 05). Git history shows this file was committed first.

## Compared

- **Ward:** `/ward:check`, skill v1 (`prompts/ward-check/SKILL.md`, as
  committed with this file), Ward's MCP server at the same commit, Sonnet
  5.5, one trial per case, HO-01…HO-10 at their parent commits. Tools:
  Read, Grep, Glob, Skill, Write (only `.ward/`), Ward's tools. Same
  isolation as the gate.
- **Claude alone:** the gate's runs (`gate.md`, 2026-11-23), not rerun.
  Same model, commits, isolation and one trial.

The prompts differ on purpose: `alone` got the task prompt ("is it
ready?"); Ward gets `/ward:check`, what a user would type. The result
is the product against Claude alone, not one prompt against another.

## Scoring

Ward's `.ward/report.json` becomes findings in code
(`evals/src/report-findings.ts`): one per check ID that has evidence
(FAIL, or NEEDS DYNAMIC/MANUAL with a file:line), its controls as MASVS
IDs, its MASWE IDs, its evidence as locations. Checks with no evidence
can't be placed and are counted, not scored. Then the bar's three
metrics (`held-out-bar.md`), by the same scorer and the same hand
labels: found, decoys flagged, wrong citations. A FAIL row's IDs come
from Ward's index, so "wrong citation" here means the ID names a
different weakness than the finding's evidence shows.

## How it is read

- Found means what the bar says: the finding describes the case's
  problem, not only that it sits near the anchor. Ward has many
  evidenced rows (analyzer and MANUAL rows in manifests and Gradle
  files), so the scorer's place-only proposals are checked by hand
  against the check's title and evidence, the same as for `alone`.
  For absence cases (any line in the file matches), only a check about
  the missing protection counts.
- Main number: cases found, Ward vs `alone` (3 of 10). With one trial
  each, only a large gap means anything: Ward at 6 or more would be a
  clear sign; 4 or 5 is noise.
- Harder kinds (HO-01, 02, 03, 04, 08, 09, 10): `alone` missed 4. Ward's
  analyzers target HO-02 and HO-04; the code cases (HO-05, 06, 07) need
  the agent to read deeper.
- Wrong citations, as a share of IDs cited (`alone`: 25 of 83, 30%),
  graded per ID as for `alone`: a MASWE ID is wrong if it names a
  different weakness; a MASVS control if the finding is not about that
  control's topic. A check under several controls lists them all, and
  each is graded. Ward should be near 0%; 2 or more wrong in absolute
  terms (the bar's rule) means IDs still go wrong somewhere.
- Decoys: `alone` 0. Ward flags far more rows; more than 1 decoy is a
  precision problem.
- Also reported: time and API-equivalent $ per run, FAIL rows per case,
  and checks left without evidence.

No tuning on these results: the skill changes only in a later plan, and
a new skill version gets its own one run, logged.
