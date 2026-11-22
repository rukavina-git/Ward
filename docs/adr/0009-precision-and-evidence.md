# 9. Ward's claim: precision and evidence, not completeness

Date: 2026-11-22
Status: Accepted

## Context
The baseline (plan 2, evals/results/example-app/baseline.md) ran Claude
Code alone, with a plain checklist skill and with OWASP's plugin on Ward's
example app. Claude Code alone found 21.7 of 23 planted issues on average,
never fewer than 21. It missed an absence (no account deletion) and a
vulnerable Gson version. On the clean twin it raised 1 to 3 false alarms
per run. The checklist skill changed nothing measurable, and OWASP's skill
never triggered.

ADR 0001 sold Ward on completeness ("catches what Claude Code alone
skips"). On textbook issues there is little left to catch. A council
(docs/council/2026-11-22-baseline-scope.md) voted 6 of 6 to change the
claim, and to slim plan 3. Karlo asked for the chair's recommendation.

## Options
- **Keep completeness and let plan 6 decide.** No change now. Con: it
  ignores the baseline, and a gain over 21.7/23 can't show at N=3.
- **Precision and evidence** (chosen). Every control in scope gets a
  verdict with evidence, exact facts come from plain code, things that
  must exist are checked, and false alarms drop. Pro: it targets what the
  baseline shows the agent lacks. Con: the gain is small and noisy on the
  current twin, and a tool can "win" on false alarms by holding findings
  back.
- **Breadth first (privacy and Play ahead of security).** Con: the agent
  found the planted privacy issues; it missed an absence, not a domain.
- **Workflow (triage, remembered decisions).** Useful, but it's already
  planned (plan 8) and doesn't answer the baseline.
- **Stop Ward.** The bar in ADR 0001 wasn't triggered, and the evidence
  gap is real.

For retrieval, the options were hybrid search from the start (ADR 0003's
plan) or exact ID lookup plus BM25 first, with vectors as a measured
comparison. For held-out cases: MASTG demos, a second app someone else
plants, or real security-fix commits from open-source apps.

## Decision
- **Claim.** Ward gives a pre-publish report you can trust and hand to an
  auditor: a verdict with evidence for every control in scope, facts with
  exact answers from plain-code analyzers, must-exist checks (such as
  account deletion), and fewer false alarms than the agent alone, without
  more false passes. This replaces ADR 0001's "completeness" selling
  point. Modules still widen the scope.
- **Retrieval (narrows ADR 0003 and 0004).** Plan 3 builds exact ID
  lookup over the control → MASWE → test graph and BM25 keyword search by
  hand, then the retrieval eval, then embeddings and vector search by hand
  as a comparison. Vectors ship only if they beat BM25 on recall@5 or MRR.
  The retrieval eval reuses findings from the baseline runs as queries.
- **Held-out set.** Before any Ward check or analyzer is written (first
  step of plan 4), build and freeze a held-out set from real security-fix
  commits in open-source Android apps: the parent commit is the flawed
  version, the fix commit the clean one. Prefer commits newer than the
  tested model's published training cutoff, and pick harder kinds:
  absences, dependency CVEs, config and build issues. Store repo URL,
  commit and answer key, not the code. MASTG demos may be smoke cases,
  labelled "in corpus", never held-out. Run Claude Code alone on the set
  as soon as it's frozen, against a bar written down first. If it finds
  nearly everything there too, with few false alarms, rethink Ward before
  plan 4 builds analyzers (Karlo's doubt, 2026-11-22: "we need another
  edge").
- **Scoring.** Add a "defensible" label: a fair question that isn't a
  defect (e.g. EA-D7, backup on with rules). It counts as neither a false
  alarm nor a hit. Grow decoys toward 30. Publish every hand grade with
  its reason; add a second grader when one is available.
- **Plan 6.** Report false passes next to false alarms and the share of
  controls with an explicit verdict. Add an analyzers-only arm (no LLM).

## Consequences
- Easier: the claim matches the data, and the demo has a clear story
  (the same app, fewer false alarms, every control accounted for). The
  npm package may not need the 34 MB embedding model.
- Harder: building the held-out set takes time, and real apps bring
  unplanted issues to grade by hand. A dependency check needs an offline
  vulnerability snapshot (OSV) kept current; check its licence first.
- Risk: a precision gain of 1 to 2 false alarms per run is noise at N=3;
  plan 6 may need more trials. Never tune Ward against a held-out case.
- Revisit after plan 6: if Ward doesn't cut false alarms without adding
  false passes, the claim fails and gets published as such.
