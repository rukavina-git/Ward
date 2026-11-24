# Held-out bar (batch 1)

Written 2026-11-23, before any run on the held-out set and before any Ward
check, analyzer or MCP tool exists. Step 02 scores Claude Code alone
against this bar. Karlo makes the call; the bar says what the numbers
mean, so the decision isn't shaped by the result.

Answer key sha256: `a422b14efae8755765f1121c0cb1220a4b46cc90fb1256903ff6613e4f04ee86`
(`evals/answer-keys/held-out.json`, keyVersion 1, 10 cases). A test fails
if the key changes without this line changing too, and git history shows
this file was committed before any result.

## Setup it applies to

Changed 2026-11-23, before any run (Karlo): the minimal gate, to save plan
usage. One pass, Sonnet 5.5 only.

- Arm: Claude Code alone, the same task prompt as the baseline
  (`prompts/eval-task.md`), each case's repo exported at its parent
  commit (files only, no git history). Model: Sonnet 5.5. One trial per
  case, 10 runs.
- No runs on fix commits and no second model or trial in this pass. Opus,
  more trials and fix-commit runs come later only if Karlo asks.

## Metrics

1. **Found.** A case counts as found when a finding points at one of its
   anchor files within 10 lines of the anchor lines and describes the
   same problem (hand-checked). For `absence` cases, a finding that names
   the missing protection in the right file or component also counts.
2. **Decoys flagged.** A decoy reported as a problem (2 decoys in batch 1).
3. **Wrong citations.** A cited MASVS, MASWE or MASTG ID that doesn't exist
   in Ward's index, or names a different weakness than the finding
   describes. Counted over all 10 runs.

Dropped for this pass: re-flags on fix commits (no fix runs),
disagreement between trials (one trial), and explicit verdicts per
control (Claude alone returns findings, not a verdict per control; plan 6
measures it once Ward gives one).

Other findings on these real apps (problems nobody labelled) are not
scored as false alarms. They are listed and graded by hand as "real",
"defensible" or "wrong", with a reason, and reported apart.

## What the result means

With 10 cases and one trial, a found rate is uncertain by about ±30
points (95%), and one run per case can be lucky or unlucky. Only large
gaps count.

"Harder kinds" below are the config, dependency and absence cases
(HO-01, 02, 03, 04, 08, 09, 10). Only HO-01, 02, 04 and 09 have a
planned analyzer; the others are kinds the roadmap stresses.

**Ward has room** if any of these hold:
- it finds 7 or fewer of 10,
- it misses 2 or more of the harder kinds,
- it makes 2 or more wrong citations.

**Rethink Ward** if all of these hold:
- it finds at least 9 of 10,
- it misses none of the harder kinds,
- it flags at most 1 decoy,
- it makes at most 1 wrong citation.

If both fire, "room" wins: any gap counts.

**In between** (anything else, e.g. 8 of 10): Karlo picks between more
runs (a second trial or Opus) and labelling batch 2 (20 more cases,
blind to batch 1's details, frozen on its own).

## Limits

- 10 cases cannot show a difference between Claude alone and Claude with
  Ward. That is for batch 2 and plan 6.
- Labelling was done by the agent alone; Karlo spot-checks at least 5
  cases before step 02. A second grader would make the labels stronger.
- Large repos (Signal, DuckDuckGo-sized) may be too big to review fully in
  one run. That is a fair test of what a pre-publish check faces, but
  step 02 records how much of each repo the agent inspected.
