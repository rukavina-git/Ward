# 06 Skill v2 on the held-out set, plus analyzers-only

## Goal
One run of skill v2 on all 28 held-out cases and one analyzers-only
pass, read against a bar written before either ran.

## Do
1. Runner and scorer know both batches (`heldOutCases()`); v2 runs go
   to their own arm (`ward-check-v2`, Ward 0.11 and later) so they never
   mix with v1; strict found also per batch and without AI-co-authored
   cases.
2. Analyzers-only arm: `npm run eval:analyzers-heldout`, no LLM, rows
   decided by analyzers only, saved as findings for the scorer.
3. Bar: `evals/held-out-v2-bar.md`, committed before any run.
4. Runs (asked first; Karlo's spot check of batch 2 done first):
   analyzers-only on 28, then ward-check v2 on 28, one each, Sonnet 5.5.
5. Score, propose labels, Karlo confirms; results and the bar's reading
   in docs/measurements.md.

## Done when
- Tests pass; both arms scored; labels confirmed; measurements written.
