# Plan 2: example app and baseline

## Why
Measure before building. Before Ward has any knowledge or tools, find
out what Claude Code already catches on its own when asked "is this app
ready to publish?". That number is the bar Ward has to beat, and ADR
0001 says to rethink Ward if Claude Code alone already finds almost
everything.

Public apps like InsecureBankv2 or DIVA are in models' training data, so
they flatter the baseline. Ward gets its own Kotlin app with planted
issues, plus a clean twin with every issue fixed. The planted app shows
what an agent misses. The twin shows what it flags that isn't there.

## Read first
CLAUDE.md, PRODUCT.md, docs/adr/0001-product-shape.md,
docs/adr/0007-no-paid-apis.md, the council's "Training-data
contamination" and "Eval arms" notes
(docs/council/2026-11-21-product-scope.md), and the glossary entries
Eval, Contamination and False pass.

## Steps
- 01 Issue list and answer key. Before writing any app code, choose the
  planted issues (security across the MASVS groups, plus a few privacy
  ones), each mapped to a MASVS control and MASWE ID, with a few decoys:
  code that looks risky but is fine. Define the answer key format.
- 02 Example app and clean twin. A small, realistic Kotlin app built
  from the issue list, and its twin with every issue fixed. Both build
  with Gradle. No hint comments or telling names.
- 03 Eval harness v0. The findings format every setup must write, the
  task prompt, a runner that runs `claude -p` on a copy of an app, and a
  scoring script with tests. Smoke-tested with one trial of Claude Code
  alone.
- 04 Baseline. Three setups: Claude Code alone, + a plain checklist
  skill, + OWASP's plugin. At least 3 trials each on both apps. Results
  and a short note on what they mean for Ward.

Step files are written one at a time, each after the previous step lands.
The roadmap listed three steps; the app step is split in two so the
answer key is fixed before any code is written.

## Invariants
- No retrieval and no Ward tools. Ward joins the eval in plan 6.
- The answer key lives under `evals/`, never under `fixtures/` (ADR
  0002).
- The agent under test sees only a copy of the app, outside the repo: no
  answer key, no git history, no docs.
- No hints in the app: no comments, names or strings that point at a
  planted issue.
- No paid APIs, no API keys. Runs use `claude -p` on Karlo's plan, never
  `--bare` (ADR 0007).
- Scoring is code. Where a match needs judgement, Karlo grades it by hand.
- Agent output is untrusted input: it's parsed and scored, never
  executed or acted on.
- Every result records the date, Claude Code version, model, setup and
  trial.
- All prompt text (the task prompt, the checklist skill) lives in
  `prompts/`.
- Results are published as they come out, even when they're bad for
  Ward.
- Licences: app dependencies are permissive only. Check the OWASP
  plugin's licence before using it. Any MASVS text keeps its CC BY-SA
  attribution.
- Secrets only in .env.local.

## Risk
Ward is built with full knowledge of this app's planted issues, so
results on it will flatter Ward. Plan 6 needs held-out cases (e.g. MASTG
demos or a second app). Never tune Ward against a specific planted issue.
