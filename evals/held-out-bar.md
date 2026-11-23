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

- Arm: Claude Code alone, the same task prompt as the baseline
  (`prompts/eval-task.md`), each case's repo checked out at its parent
  commit. Models: Sonnet 5.5 and Opus 5.5, each judged on its own.
- Each case also runs once on its fix commit (the clean twin).
- Trials: as many per model as step 02 can afford (at least 2). Rates are
  averaged over trials.

## Metrics

1. **Found.** A case counts as found when a finding points at one of its
   anchor files within 10 lines of the anchor lines and describes the
   same problem (hand-checked). For `absence` cases, a finding that names
   the missing protection in the right file or component also counts.
2. **Re-flagged on the fix.** The same issue reported on the fix commit at
   the same place. Each one is a false alarm.
3. **Decoys flagged.** A decoy reported as a problem (2 decoys in batch 1).
4. **Wrong citations.** A cited MASVS, MASWE or MASTG ID that doesn't exist
   in Ward's index, or names a different weakness than the finding
   describes.
5. **Disagreement.** Cases found in some trials of a model and missed in
   others.

Other findings on these real apps (problems nobody labelled) are not
scored as false alarms. They are listed and graded by hand as "real",
"defensible" or "wrong", with a reason, and reported apart.

## What the result means

With 10 cases, a found rate is uncertain by about ±30 points (95%). Only
large gaps count.

**Rethink Ward** if, for the better of the two models, all of these hold:
- it finds at least 9 of 10 on average,
- it misses none of the config, dependency and absence cases (HO-01, 02,
  03, 04, 08, 09, 10) in a majority of trials,
- it re-flags at most 1 case on fix commits and flags at most 1 decoy, per
  trial on average,
- it makes no wrong citation in more than one trial,
- disagreement is at most 1 case.

**Ward has room** if, for either model, any of these hold:
- it finds 7 or fewer of 10 on average,
- it misses 2 or more of the config, dependency and absence cases on
  average (the kinds Ward's analyzers target),
- it averages more than 1 wrong citation per trial,
- disagreement is 3 cases or more.

If the better model meets "Rethink" but the other shows "room", the
finding is "Ward helps only the weaker model". Karlo decides whether that
is worth building for.

**In between** (anything else, e.g. 8 of 10 with clean citations): label
batch 2 (20 more cases, toward 30) before deciding. Batch 2 is labelled
blind to the batch 1 results' details and frozen on its own.

## Limits

- 10 cases cannot show a difference between Claude alone and Claude with
  Ward. That is for batch 2 and plan 6.
- Labelling was done by the agent alone; Karlo spot-checks at least 5
  cases before step 02. A second grader would make the labels stronger.
- Large repos (Signal, DuckDuckGo-sized) may be too big to review fully in
  one run. That is a fair test of what a pre-publish check faces, but
  step 02 records how much of each repo the agent inspected.
