# Measurements

Every number Ward has measured, in one place, newest first. Each entry:
date, what was measured, setup, the numbers, what it means, and where the
raw data is. Later overviews (site, PDF, write-ups) are built from this
file, so add an entry whenever something is measured, including failures
and results that look bad for Ward.

"$" is the API-equivalent Claude Code reports. Runs are on Karlo's Pro
plan, not billed (ADR 0007).

## 2026-11-23 Held-out gate: Claude alone on real fixes (plan 4, step 02)

- **Question:** does Claude Code alone already catch real security
  issues in real Android apps? If it does, Ward has little to add.
- **Setup:** 10 real security-fix commits from 8 open-source Android
  apps, all fixed after the model's training cutoff (batch 1,
  `evals/answer-keys/held-out.json`, keyVersion 1). Claude Code alone,
  Sonnet 5.5 (`claude-sonnet-5-5`), one run per case on the flawed
  (parent) commit, files only, no git history. Same prompt as the
  baseline ("Is it ready to publish?"), read-only tools. Bar written and
  committed first (`evals/held-out-bar.md`, b0b83e2).
- **Numbers (labels proposed by Claude, accepted by Karlo):**
  - Found 3 of 10 (HO-01 via a generic finding, strictly 2; HO-09,
    HO-10). Missed HO-02, 03, 04, 05, 06, 07, 08.
  - Harder kinds (config, dependency, absence) missed: 4 of 7 (HO-02
    library manifest, HO-03 and HO-08 absences, HO-04 vulnerable
    dependency). Code cases found: 0 of 3.
  - Wrong citations: 25 of 83. MASWE: 18 of 19 wrong against v1.0.0
    (e.g. logging cited as 0001, really 0005; backup as 0004, really
    0006; cleartext as 0050, really 0026). MASVS: 7 of 64 wrong.
  - Decoys flagged: 0. Other findings: 53, not graded.
  - Depth: 4 to 11 files read per repo, 21 to 51 s per run, even on
    Signal (12,150 files).
  - Usage: 10 runs ≈ 16 points of the 5-hour Pro window (49% → 65%,
    including other work), $0.13 to $0.28 each, $1.87 total.
- **Bar outcome:** Ward has room. All three room rules fire.
- **What it means:** asked "is it ready?", Claude alone gives a fast,
  plausible review that misses most real issues in big repos and cites
  MASWE IDs from wrong numbers. Caveats: 10 cases, one trial, one
  model, labels by Claude; planned analyzers cover only HO-02 and HO-04
  directly.
- **Decision:** Karlo, 2026-11-23: continue with Ward.
- **Raw data:** `evals/results/held-out/` (gate.md; meta.json,
  findings.json, grades.json per run; transcripts local only).

## 2026-11-22 Baseline: example app with planted issues (plan 2)

- **Question:** how good is Claude Code alone on a small app with known,
  planted issues?
- **Setup:** `fixtures/example-app` (23 planted issues) and its clean
  twin, Sonnet 5.5, 3 trials per arm. Arms: alone, plain MASVS checklist
  skill, OWASP Secure Agent Playbook skills.
- **Numbers:** alone found 21.7 of 23 (21 to 22), precision 97%, 0.7
  false alarms; checklist 21.0, owasp 21.3. Twin: 1.7 to 2.3 false
  alarms per run. About 1 minute and $0.25 per run.
- **What it means:** on a small, planted app Claude alone is already
  very good; skills added nothing measurable. ADR 0001's revisit bar was
  not triggered. Note: "bad citations" there checked file and line only,
  not whether a MASWE ID names the right weakness; the held-out gate
  checks that too.
- **Raw data:** `evals/results/example-app/baseline.md`, `summary.json`.

## 2026-11 Retrieval: finding the right OWASP entry (plan 3)

- **Question:** given a finding or question, does Ward's search return
  the right MASVS/MASWE/MASTG entry?
- **Setup:** 80 dev queries (from baseline findings, misses, coverage
  and ID lookups) plus 12 with no right answer
  (`evals/questions/retrieval.json`).
- **Numbers (dev, recall@5 / MRR):** IDs only 0.06 / 0.06; BM25
  0.875 / 0.667; BM25 tuned 0.938 / 0.811; vectors 0.838 / 0.600;
  hybrid 0.950 / 0.759; hybrid tuned 0.963 / 0.803. No retriever can
  tell "nothing relevant" queries apart.
- **What it means:** tuned BM25 is nearly as good as hybrid and far
  simpler, so BM25 ships alone (ADR 0010).
- **Raw data:** `evals/results/retrieval/*.json`; details in
  `docs/plans/knowledge-base/progress.md`.
