# Held-out bar for skill v2 (plan 6, step 06)

Written 2026-11-27, before any skill v2 or analyzers-only run on the
held-out set. Git history shows this file was committed first. It states
what the numbers mean, so the reading isn't shaped by the result.

Keys: batch 1 sha256 `a422b14efae8755765f1121c0cb1220a4b46cc90fb1256903ff6613e4f04ee86`
(10 cases), batch 2 sha256 `ba13a05d7acba4de15ffb4476624d052ab20c6fbcf2c8d5bda5fea5a7ef7b7bb`
(18 cases). 28 cases in all.

## Setup
- **ward-check v2:** `/ward:check` with skill v2.1, Ward 0.13.x, Sonnet
  5.5, one run per case (28 runs), each case's repo exported at its
  parent commit. Scored as arm `ward-check-v2`.
- **analyzers-only:** Ward's analyzers alone, no LLM
  (`npm run eval:analyzers-heldout`), same exports. Arm `analyzers`.
- **For comparison, already run (batch 1 only):** Claude alone (strict
  2 of 10, lenient 3) and ward-check v1 (strict 2 of 10, lenient 5).
- Scoring rules: `evals/scoring.md` (strict is the main number) and
  `evals/held-out-bar.md` (lenient). Strict labels are proposals until
  Karlo checks them.

## What the result means
With 28 cases and one trial a found rate is uncertain by about ±18
points; with batch 1 alone (10) by about ±30. Only large gaps count.

1. **Depth helped (batch 1, v2 vs v1):** v2 finds at least 5 of 10
   strict (v1: 2). At 3 or fewer, skill v2 didn't change what Ward
   finds; 4 is too close to call.
2. **The agent adds something over plain code:** v2's strict found on
   28 is at least the analyzers-only strict found plus 4. Below that,
   the agent's reading adds too little to tell apart from the
   analyzers.
3. **Ward is worth carrying into Plan 7 as it is:** v2 strict found is
   at least 14 of 28 (half). At 8 or fewer (under about 30%), rethink
   the agent part (how the skill reads code) before adding the privacy
   module. In between: carry on, and say plainly in Ward's own
   materials that it finds about a third to a half of real issues.
4. **Guard rails:** at most 1 of the 3 decoys flagged as a FAIL, and at
   most 3 wrong citations in all 28 runs. More than that is a finding
   on its own, whatever found is.

If rules point different ways, each is reported as it is; none is
averaged away.

## Reported beside it
Lenient found; strict per kind and per batch; strict without the five
AI-co-authored fixes (HO-14, 17, 18, 19, 27; Karlo's call, 2026-11-26);
decoys, wrong citations, other findings; minutes and API-equivalent
cost per run; proxy depth share.

## Limits
- No Claude-alone run on batch 2, so "Ward vs Claude alone" stays a
  batch 1 comparison (n = 10). An alone arm on batch 2 is 18 more runs;
  Karlo decides.
- One trial per case: a lucky or unlucky run moves a case. More trials
  are Plan 9 (ADR 0013).
- Batch 2 was labelled by the session that built Ward; see
  `evals/held-out-batch2.md` for how that was guarded.
