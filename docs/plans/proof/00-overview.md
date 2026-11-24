# Plan 6: proof

## Why
Skill v1 on the held-out set found 5 of 10 leniently, 2 by a real FAIL.
The agent never called `get_check` and judged most checks by title
(36 of 56 on Karlo's app). This plan makes Ward read deeper (skill v2),
proves it on the example app with free metrics first, then runs v2 once
on 30 held-out cases with strict scoring, and tests prompt injection.

Order and scope come from the council of 2026-11-24
(docs/council/2026-11-24-plan6-scope.md) and ADR 0013.

## Read first
CLAUDE.md, PRODUCT.md, ADR 0012, 0013, the council minutes above,
evals/README.md, evals/held-out-bar.md, evals/held-out-ward-check.md,
the Gotchas in docs/plans/the-check/progress.md (step 05 and 07), and
the glossary entries Held-out set, Leakage, Defensible finding and
False pass.

## Steps
- 01 Depth marking and free metrics. Each check row says how deep its
  verdict went (analyzer, index, test text, title only), set in code
  from what Ward served the agent. A proxy CLI reads saved runs (tool
  calls, test-text share, NO FINDING without evidence, false NO FINDING
  on a planted issue). Strict scoring (a FAIL on the case's problem)
  in the held-out scorer, lenient beside it; rules written down.
- 02 Skill v2: the skeleton carries each open check's MASTG test text,
  one group per call; NO FINDING needs files read and a reason tied to
  them; FAILs grouped by finding. Dev runs on the example app and its
  clean twin until the proxy gate passes (asked first).
- 03 Label held-out batch 2: 20 more cases, frozen before v2's run;
  Karlo spot-checks.
- 04 Prompt-injection tests in code: hostile text in the app can't
  change IDs, verdicts, the rollup or the summary.
- 05 Prompt-injection agent runs (1–3): a canary comment next to a
  planted bug; scored in code (did that row flip?).
- 06 Skill v2 on the held-out set (30 cases, strict and lenient), plus
  the analyzers-only arm. Pre-registered first.

Step files are written one at a time, each after the previous lands.

## Invariants
- Never tune Ward on held-out cases. Skill changes are tried on the
  example app; the held-out set runs once per skill version, logged.
- Held-out runs only after the proxy gate passes on dev runs (v2 reads
  the test text for about 80% of the checks it answers).
- Strict scoring from now on: found means a FAIL on the case's problem;
  MANUAL rows never count. Lenient is reported beside it.
- No LLM calls at runtime. Eval runs go through `claude -p` on Karlo's
  plan and are asked for first.
- Verdicts: FAIL, NO FINDING, NEEDS DYNAMIC, MANUAL, N/A. Never PASS.
- IDs come from the pinned index; depth is set in code, never by the
  model.
- The checked app's text is untrusted input; stdout is the MCP protocol.
- Prompts live in prompts/; changing one is a code change.
- After any server change: `npm run plugin:build`, commit `plugin/`.

## Risk
- v2 is tuned on one planted app and may overfit.
- One trial on 30 cases is still noisy; say so plainly.
- Test text per group may push skeleton pages past the output cap.
- "Test text served" is not "test text understood": depth shows what
  Ward gave the agent, not what it made of it.
