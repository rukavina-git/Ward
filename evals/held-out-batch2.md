# Held-out batch 2: freeze note

Frozen 2026-11-26 (plan 6, step 03), before any run on batch 2 and
before skill v2's held-out run (step 06). Git history shows this file and
the key were committed together, before any result.

Answer key sha256: `b17ec404e636cf89bc43a147cf246ac6579bf3aa70d1be5de90cc63188137daa`
(`evals/answer-keys/held-out-2.json`, batch 2, 20 cases, HO-11 to HO-30).
A test fails if the key changes without this line changing too.

## What is in it
- Kinds: code 8, config 7, absence 2, dependency 3.
- Severity: high 3 (HO-13, HO-18, HO-22), medium 17.
- 18 repos; at most 3 cases per repo across both batches (AnkiDroid 2,
  onyx-browser 2; Home Assistant and Signal 2 each with batch 1).
- Every fix dated 2026-07-15 to 2026-11-18, after both models' June 2026
  training cutoff.
- Decoys: 2 (HO-22, HO-29).
- `npm run heldout:check -- evals/answer-keys/held-out-2.json` passed on
  2026-11-26: every repo and commit exists, each fix's parent is the stated
  parent, and every anchor sits on its lines in the parent commit.

## How it was labelled
By the agent (Claude Opus 5.5), the same session that built Ward. To keep
that from shaping the set, the rules were written before searching
(`docs/plans/proof/steps/03-held-out-batch-2.md`) and every candidate
looked at is logged with its outcome (`evals/held-out-batch2-log.md`):
19 commits kept (20 cases), 5 in reserve, 29 dropped. No case was kept or dropped for whether
Ward would find it.

## Scoring
Batch 2 is scored by the same rules as batch 1 (`evals/held-out-bar.md`
for lenient found, `evals/scoring.md` for strict). Step 06 states its
pre-registered bar for all 30 cases before its run.

## Limits
- Absence cases are few (2): few fixes after the cutoff add a check that
  is missing and visible in the code.
- Two cases come from small apps (HO-28, HO-29/30), as HO-09 did in
  batch 1.
- HO-29 and HO-30 share one fix commit (two separate files).
- Karlo spot-checks at least 5 cases before step 06.
