# 13. Plan 6: depth before breadth

Date: 2026-11-24
Status: Accepted

## Context
Skill v1 on the held-out set found 5 of 10 leniently but only 2 by a
real FAIL. The agent never called `get_check` or `search` and missed
every code and absence case. On Karlo's app it judged 36 of 56 checks
by title. The roadmap's Plan 6 was a five-arm, 3-trial eval (~165 runs)
and retrieval fixes. Plan usage is scarce. A council
(docs/council/2026-11-24-plan6-scope.md) voted unanimously.

## Options
- **Full five-arm eval first** (roadmap). Strong numbers. Con: ~165
  runs measuring a skill already known to read shallowly; stale once
  the skill changes.
- **Small two-arm, 3-trial eval of v1.** Cheaper (~66 runs). Con: same
  problem, still can't separate 5/10 from 3/10.
- **Skill v2 first, then one held-out run** (chosen). Fixes the known
  gap; a few dev runs plus one pass.
- **Retrieval fixes (reranking).** Con: `search` is called 0 times, so
  nothing to improve yet.

## Decision
- Plan 6 builds skill v2 on the example app: the skeleton carries each
  check's MASTG test text, each verdict is marked "test text read" or
  "title only", NO FINDING is tied to evidence.
- Held-out runs only after a free proxy passes on the dev runs (v2
  reads the test text for about 80% of checks).
- Scoring is strict from now on: found means a FAIL on the case's
  problem; MANUAL rows never count as found. Lenient is reported beside
  it, for comparison with v1. Pre-registered before the run.
- Batch 2 (20 more held-out cases) is labelled before v2's held-out
  run, so it covers 30 cases.
- Prompt injection: tests in code first, then 1–3 agent runs with a
  canary next to a planted bug.
- Reranking is dropped. The analyzers-only arm (no LLM) runs every
  time. The full five-arm, 3-trial eval moves to Plan 9, before the
  site publishes numbers.
- develop is merged to main before Plan 6 starts.

## Consequences
- Easier: plan usage goes to the change that can move the numbers; the
  story reads "measured, found the gap, fixed it, measured again".
- Harder: v2 is tuned on one planted app and may overfit; one trial
  stays noisy, even on 30 cases.
- Revisit reranking if v2 traces show `search` called with bad hits.
