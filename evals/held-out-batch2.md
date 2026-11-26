# Held-out batch 2: freeze note

Frozen 2026-11-26 (plan 6, step 03), re-frozen the same day after the
step's review (two cases dropped, before any run; first freeze fb1b830), before any run on batch 2 and
before skill v2's held-out run (step 06). Git history shows this file and
the key were committed together, before any result.

Answer key sha256: `ba13a05d7acba4de15ffb4476624d052ab20c6fbcf2c8d5bda5fea5a7ef7b7bb`
(`evals/answer-keys/held-out-2.json`, batch 2, 18 cases, HO-11 to HO-28).
A test fails if the key changes without this line changing too.

## What is in it
- Kinds: code 8, config 5, absence 2, dependency 3.
- Severity: high 3 (HO-13, HO-18, HO-21), medium 15.
- 17 repos; at most 3 cases per repo across both batches (AnkiDroid 2;
  Home Assistant and Signal 2 each with batch 1).
- Every fix dated 2026-07-15 to 2026-11-18, after both models' June 2026
  training cutoff.
- Decoys: 1 (HO-21). Defensible: 2 (HO-21's unfixed MMS receivers).
- `npm run heldout:check -- evals/answer-keys/held-out-2.json` passed on
  2026-11-26: every repo and commit exists, each fix's parent is the stated
  parent, and every anchor sits on its lines in the parent commit.

## How it was labelled
By the agent (Claude Opus 5.5), the same session that built Ward. To keep
that from shaping the set, the rules were written before searching
(`docs/plans/proof/steps/03-held-out-batch-2.md`) and every candidate
looked at is logged with its outcome (`evals/held-out-batch2-log.md`):
18 kept, 5 in reserve, 31 dropped. No case was kept or dropped for whether
Ward would find it.

## Scoring
Batch 2 is scored by the same rules as batch 1 (`evals/held-out-bar.md`
for lenient found, `evals/scoring.md` for strict). Step 06 states its
pre-registered bar for all 30 cases before its run.

## Limits
- Absence cases are few (2): few fixes after the cutoff add a check that
  is missing and visible in the code.
- Code is 8 of 18 (44%), over the plan's "about a third"; the test
  allows 40% rounded up (8).
- Two cases come from small apps (HO-27, HO-28), as HO-09 did in batch 1.
- Five fixes name an AI co-author in the commit: HO-14 (GPT), HO-17,
  HO-18, HO-19 (Claude Opus 5.5), HO-27 (Claude Sonnet 5). A co-author
  wrote the patch; whether an AI also found the issue is unknown. Karlo
  kept them (2026-11-26); step 06 reports found with and without them.
- Karlo spot-checks at least 5 cases before step 06.
