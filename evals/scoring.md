# Scoring rules from Plan 6

Written 2026-11-24 (plan 6, step 01), before any skill v2 run. Git
history shows this file was committed first. ADR 0013 decided these
rules; this file states them so a run can be checked against them.

## Held-out: found

- **Strict (main number).** A case is found when a FAIL finding
  describes the case's problem: Ward's FAIL row, or for `alone` a
  finding the model marked FAIL. MANUAL and NEEDS DYNAMIC rows never
  count. The scorer proposes it (lenient found and a FAIL among the
  case's candidates); Karlo checks that the FAIL is about the case and
  may set `strict.label` in grades.json.
- **Lenient (beside it).** The bar's rule as in `held-out-bar.md`: a
  finding near the anchor that describes the problem, any verdict. Kept
  so v2 can be compared with v1 and with the gate.
- Both are reported in every arm table (`npm run eval:score-heldout`).
- Decoys and wrong citations are scored as before.

Skill v1, re-scored with this rule (no new runs): Ward 2 of 10 strict
(HO-04, HO-10), 5 lenient; Claude alone 2 strict (HO-09, HO-10), 3
lenient. Strict labels for these are proposals until Karlo checks them.

## Dev runs: the proxy gate

`npm run eval:proxy -- <run dirs>` reads a saved run's report and
transcript. No model call.

- **Test-text share:** of the distinct checks the agent answered, the
  share answered after Ward served that check's text. From each row's
  `depth` (Ward 0.10 on); for older reports from the transcript's
  `get_check` calls.
- **Gate:** a held-out run of a new skill version only after its dev
  runs on the example app reach a test-text share of 80% or more.
- Also shown, not gated: Ward tool calls by name, agent NO FINDINGs
  with no files read or no evidence, and on the planted app the planted
  issues with a NO FINDING on one of their MASTG tests or MASWE
  weaknesses (a lead for a hand check: false NO FINDING).

Skill v1 (no new runs): test-text share 0% on the example-app run and
on all 10 held-out runs; `get_check` and `search` were never called.

## What these numbers can't say

Depth says Ward served the text, not that the agent understood it. One
trial per case is noisy: on 30 cases, a difference of a few cases is
not a result.

## Hardening rows (ADR 0014, added 2026-11-25, before step 06)

Ward's hardening rows (`hardening: true`) are not turned into findings.
The `alone` arm has no such flag: its root-detection or pinning findings
are still scored and labelled `generic` by hand, which keeps them out of
precision. The held-out key has no hardening ID, so found counts are not
biased; the risk is a planted problem filed only under a hardening test
(HO-10 under 0352 instead of 0227). Step 06 checks Ward's dropped
hardening rows against the held-out anchors by hand.
