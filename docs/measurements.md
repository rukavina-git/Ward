# Measurements

Every number Ward has measured, in one place, newest first. Each entry:
date, what was measured, setup, the numbers, what it means, and where the
raw data is. Later overviews (site, PDF, write-ups) are built from this
file, so add an entry whenever something is measured, including failures
and results that look bad for Ward.

"$" is the API-equivalent Claude Code reports. Runs are on Karlo's Pro
plan, not billed (ADR 0007).

## 2026-11-25 Skill v2.1 + hardening apart: dev runs (plan 6, step 02)

- **Question:** do the two fixes cut noise without losing planted bugs?
  Fix 1 (skill v2.1, server 0.12.0): the agent may settle an analyzer
  MANUAL. Fix 2 (ADR 0014, server 0.13.0): hardening checks reported
  apart, and the eval no longer turns them into findings.
- **Setup:** ward-check arm, Sonnet 5.5, one run each. Clean t2 on
  0.12.0 (fix 1 only); planted t2 and clean t3 on 0.13.0 (both). A
  planted run on 0.12.0 was stopped and deleted: it rebuilt Ward
  mid-edit.
- **Numbers, before → after:**
  - Clean twin: findings 16 → 11 (fix 1, agent behaviour) → 3 (fix 2,
    which is a report and scoring change: the 8 hardening rows are no
    longer findings, not behaviour). Decoy false alarms 3 → 0 → 0. Proxy 100% each. Left: Mixpanel FAIL (proposed
    false alarm), 2 MANUAL (dependency versions, privacy policy).
    253 s, $1.54.
  - Planted: auto-matched 15/23 → 17/23; with the proposed labels
    16 → 23/23 (t1 proposals reached 20). EA-03 (logging) and EA-05
    (helpdesk token) now found. Precision 100%, 0 false alarms, 0 bad
    citations of 59. Proxy 94% (59 of 63; t1 98%). 224 s, $1.42.
    Report: 17 controls FAIL, 51 checks FAIL, 14 hardening FAILs listed
    apart (clean t3: 2 controls FAIL, 2 checks FAIL, same 14 apart).
- **What it means:** both fixes do what they should on one run each:
  the twin's noise drops to one arguable finding, and nothing planted
  is lost. Still one trial per app; the held-out run (step 06) is the
  real test. Labels are proposals until Karlo confirms them.
- **Raw data:** `evals/results/example-app/2026-11-25-ward-check-{clean-t2,planted-t2,clean-t3}/`.

## 2026-11-25 Skill v2 dev run, clean twin (plan 6, step 02)

- **Question:** does skill v2 read the test text on the clean twin
  too, and how much noise does it raise on an app with no planted bugs?
- **Setup:** `/ward:check` on the clean twin, Sonnet 5.5, one run
  (trial 1), ward-check arm, same as the planted run.
- **Numbers:** 226 s, 75 turns, $1.42 API-equivalent (plan, not
  billed). Proxy: 56 agent answers, 56 after the test text (100%),
  gate passes. `report_skeleton` 8, `get_check` 3, `search` 0. 32 NO
  FINDING, all with files read. Scorer (provisional, 13 of 16
  ungraded): 16 findings, 3 auto false alarms on decoys (EA-D4 once,
  EA-D7 twice), 0 bad citations of 24. The 3 are all MANUAL analyzer
  rows the agent left open (exported HelpActivity; backup rules "check
  that they exclude credentials"), not FAILs. FAILs on decoys: 0.
  The 16: FAIL 9, MANUAL 7. Seven FAILs are missing hardening
  (enforced updates, storage integrity, Security Provider, screen
  capture, overlay, root, debugger detection); one is the keyboard
  cache on the private note; one is user data sent to Mixpanel.
- **What it means:** the gate holds on both apps. The decoy noise comes
  from MANUAL rows: the agent didn't open `backup_rules.xml` to settle
  EA-D7, although the file is one step away. The other noise is
  MASVS-RESILIENCE: v2 FAILs every missing hardening control, which is
  true to MASTG but noisy for an ordinary app. Baseline twin (Claude
  alone): 1.7 to 2.3 false alarms; not yet comparable until the 13 are
  graded.
- **Raw data:** `evals/results/example-app/2026-11-25-ward-check-clean-t1/`.

## 2026-11-24 Skill v2 dev run, planted app (plan 6, step 02)

- **Question:** does skill v2 (test text in the skeleton, NO FINDING
  tied to files) make the agent judge checks by the MASTG text?
- **Setup:** `/ward:check` on `fixtures/example-app`, Sonnet 5.5, one
  run, ward-check arm. Clean twin not run yet.
- **Numbers:** 199 s, 47 turns, $1.19 API-equivalent (plan, not
  billed). Proxy: 57 agent answers, 56 after the test text (98%; v1
  0%), gate passes. `report_skeleton` 8 calls (one per group),
  `get_check` 1, `search` 0. 23 NO FINDING, all with files read.
  Planted issue with a NO FINDING on its test: EA-03 (HTTP bodies and
  auth headers logged, cross-file, MASTG-TEST-0231). Scorer
  (provisional, 10 findings ungraded): 15 of 23 found, precision 95%,
  1 false alarm; the ungraded findings touch 6 of the 8 misses (EA-02,
  03, 04, 21, 22, 23), so recall is a lower bound. Checks: FAIL 44,
  NO FINDING 47; depth: analyzer 31, index 117, test text 91, title
  only 3.
- **Plan usage:** Karlo's `/usage` before and after (to be filled in).
- **What it means:** serving the text works: the agent now answers
  from it nearly every time, at about v1's cost (+25%). Served is not
  understood: EA-03 still got a NO FINDING with the text in hand.
- **Raw data:** `evals/results/example-app/2026-11-24-ward-check-planted-t1/`.

## 2026-11-24 Skill v1 baseline: depth and strict scoring (plan 6, step 01)

- **Question:** before skill v2, how deep did v1 look, and what is v1's
  score when only a FAIL counts?
- **Setup:** no new runs. `npm run eval:proxy` on v1's saved runs
  (example-app smoke run, both dev reports, held-out HO-01…HO-10), and
  `npm run eval:score-heldout` with the new strict column (rules in
  evals/scoring.md).
- **Numbers:** `get_check` and `search` calls: 0 in every run. Test-text
  share of agent answers: 0% everywhere (example app 0 of 57; held-out
  0 of 56 in 9 runs, 0 of 16 in HO-05). Proxy gate (80%): failed by
  every v1 run. Agent NO FINDINGs: 16 on the example app, 6–25 per
  held-out run; nearly all list files read, none carry file:line
  evidence. Planted issues with a NO FINDING on their tests (example
  app): none. Held-out found, strict / lenient: Ward 2 / 5 of 10
  (HO-04, HO-10), Claude alone 2 / 3 (HO-09, HO-10). Strict labels are
  proposals until Karlo checks them.
- **What it means:** strictly, v1 ties Claude alone at 2 of 10; Ward's
  lenient lead came from MANUAL rows. v1 judged every agent-answered
  check by its title. That is the gap skill v2 targets, and the proxy
  gives a free number to watch on dev runs.
- **Raw data:** evals/results/held-out/*.md and grades.json (strict
  fields), the proxy table from the command above.

## 2026-11-23 Installed plugin on Karlo's own app (plan 5, step 07)

- **Question:** does the installed plugin work on a real app Ward has
  never seen, and are its FAILs right?
- **Setup:** plugin 0.9.0 from the local marketplace, `/ward:check`,
  full scope, variant release, on GymBuddy (Karlo's Kotlin/Compose app).
  One run, Karlo's usual Claude Code session and model. Labels by Karlo.
- **Numbers:** 4 min 50 s. Controls: FAIL 5, MANUAL 17, NEEDS DYNAMIC 2.
  Checks: FAIL 7, MANUAL 93, NEEDS DYNAMIC 49, NO FINDING 48, N/A 45.
  Citation check: all confirmed. The 7 FAIL rows are 4 findings, each
  under two controls. Labels: security provider not updated
  (MASTG-TEST-0295) real, low priority; user ID to Crashlytics
  (MASTG-TEST-0318) intended, a Data safety disclosure; keyboard cache on
  the email field (MASTG-TEST-0258) false alarm; no overlay protection on
  login (MASTG-TEST-0340) intended. So 1 false alarm of 4; no misses
  known. Analyzers (manifest, network, build config, dependencies,
  must-exist) gave no FAIL. The agent read test text (`get_check`) for 20
  of 56 checks it filled; the other 36 from titles only.
- **What it means:** the plugin installs and runs end to end on a real
  app with no noise from the analyzers. The one false alarm is the agent
  applying a password-field test to an email field. Gaps: Karlo's own
  guard hook blocked the agent from `app/src/prod` and a properties
  file, so the agent didn't read them.
- **Raw data:** kept in the app's repo (`.ward/report.json`, not
  committed here).

## 2026-11-23 /ward:check on the held-out set, skill v1 (plan 5, step 05)

- **Question:** does Ward's report find what Claude alone missed on 10
  real fixes, with right IDs?
- **Setup:** arm `ward-check` (`/ward:check`, Ward's plugin and MCP
  server, Write limited to `.ward/`), Sonnet 5.5, one trial per case,
  HO-01…HO-10 at their parent commits, the same isolation as the gate.
  The report was converted to findings in code and scored by the gate's
  scorer. Pre-registered in `evals/held-out-ward-check.md`. Labels were
  proposed by Claude and confirmed by Karlo on 2026-11-24 (lenient
  reading for HO-01, 02, 09).
- **Numbers:** found 5 of 10 (HO-01, 02, 04, 09, 10). That is 2 of 10
  counting only FAILs; `alone` found 3. Harder kinds missed: 2 (HO-03,
  08); `alone` missed 4. Decoys flagged: 0 (2 place matches inside
  MANUAL lists). Wrong citations: 0 of 243; `alone` had 25 of 83. FAIL
  rows per case: 2–8. Time: 51–189 s, $0.20–0.79 per case, $6.16 in
  total. Ward tool calls: `report_skeleton` 71, `write_report` 17,
  `dependencies` 1, `get_check` and `search` 0. 5 runs were re-checked
  after an isolation-check fix (see the step 05 deviations).
- **What it means:** right IDs every time, and the analyzers catch the
  config and dependency cases (HO-02 and HO-04 were new compared with
  `alone`). Ward adds nothing on code-level bugs or absences: the agent
  still doesn't read deeper. 5 vs 3 is within one-trial noise. The bar
  says "room".
- **Raw data:** `evals/results/held-out/2026-11-23-ward-check-*`,
  `evals/results/held-out/ward-check.md`.

## 2026-11-23 First /ward:check runs, skill v1 (plan 5, step 04)

- **Question:** does the skill make the agent use the skeleton and
  finish with a checked report?
- **Setup:** `/ward:check` on copies of `fixtures/example-app` and its
  clean twin, Sonnet 5.5, one run each, isolated like the eval arms
  (Read, Grep, Glob, Skill, Write + Ward's tools). Dev runs, not scored
  by the eval scorer.
- **Numbers:** planted app: 3.5 min, 50 turns, $0.94; 58 fills, all
  applied; first `write_report` had 13 citation issues (all
  `not-a-file`: folders in `filesInspected`), 0 after one retry. 24
  controls: FAIL 15, MANUAL 9; checks FAIL 42, NO FINDING 40, N/A 15.
  A FAIL within 3 lines of 22 of the 23 planted FAIL items (EA-23
  missed; rough file:line match, decoys not scored). Clean twin: 3.9
  min, 64 turns, $1.01; 57 fills; same 14 → 0 retry; 3 FAIL rows, all
  one finding (plaintext CSV backup, `AutoBackupWorker.kt:23`).
- **Tool use:** `report_skeleton` 9 times (the full answer was too large
  to show inline, so the agent fell back to one call per group),
  `write_report` 2, `get_check` and `search` 0.
- **What it means:** the skeleton works: every control got a verdict,
  IDs come from code, every quote shown passed. The agent judges tests
  by title alone (no `get_check`). About 4× the time and cost of
  Claude alone (baseline ~1 min, $0.25).
- **Raw data:** `evals/results/ward-check-dev/skill-v1/`.

## 2026-11-23 Report skeleton size and prefill (plan 5, step 02)

- **Question:** does the full `report_skeleton` fit the MCP output cap,
  and how much of it does Ward fill before the agent starts?
- **Setup:** both fixtures (no build/, OSV offline, empty cache); tokens
  as JSON chars / 4. 24 controls, 240 checks (191 test rows, 49
  weaknesses with no test).
- **Numbers (example / clean):** full scope 17,601 / 17,178 tokens
  (22,050 before trimming repeated reasons and per-check file lists);
  L1 only 9,284 / 8,934; MASVS-NETWORK 2,251 / 2,256. Checks prefilled:
  FAIL 12 / 0, NO FINDING 8 / 18, MANUAL 79 / 81, NEEDS DYNAMIC 49 / 49,
  N/A 1 / 1; left for the agent: 91 / 91.
- **What it means:** the whole skeleton fits under the 20k test cap with
  little room; real apps with long analyzer evidence may need paging by
  group. 149 of 240 checks are decided before the agent reads any code,
  most as MANUAL or NEEDS DYNAMIC from the index.
- **Raw data:** `packages/mcp/src/report-skeleton-tool.test.ts`.

## 2026-11-23 MCP tool output sizes (plan 5, step 01)

- **Question:** does every Ward tool answer fit Claude Code's MCP output
  limit (about 25k tokens) with room to spare?
- **Setup:** each tool on the example app and its clean twin (no build/,
  OSV offline with an empty cache); tokens estimated as JSON chars / 4.
- **Numbers:** manifest 2,602 / 2,170; network 617 / 624; build_config
  453 / 425; dependencies 1,231 / 1,231 (example / clean); checklist
  12,119. The cap test allows 20,000. Plan 4's HO-04 `dependencies`
  answer was about 11k tokens before trimming (not re-measured: held-out
  repos aren't used for tuning).
- **What it means:** every tool is well under the cap on the fixtures;
  checklist is the largest. Real apps with many modules will be bigger.
- **Raw data:** `packages/mcp/src/analyzer-tools.test.ts` (output cap).

## 2026-11-23 First run with Ward's MCP tools, HO-04 (plan 4, step 07)

- **Question:** given Ward's MCP tools, does Claude Code use them, and
  does it then find a held-out fix that Claude alone missed?
- **Setup:** arm `ward` (Ward's MCP server only, no skill, same task
  prompt), Sonnet 5.5, one trial, HO-04's parent commit (nextcloud
  talk-android). Compared with the gate's `alone` run of HO-04.
- **Numbers:** found HO-04 (alone: missed). 7 findings; 4 Ward calls
  (manifest, build_config, network, dependencies), 0 searches. MASWE IDs:
  1 of 5 right (MASWE-0044, given by Ward's tool); MASVS 7 of 7 right.
  28 s, 13 turns, 5 files read, $0.23 (alone: 36 s, 14 turns, 7 files,
  $0.17). The dependencies result alone was 45 KB (about 11k tokens).
- **What it means:** with no instructions, the agent called Ward's
  analyzers on its own and the dependency check turned a miss into a
  hit. IDs are right only where Ward's output names them: analyzer
  verdicts should carry MASWE IDs. One case, one trial: an anecdote,
  not a score.
- **Raw data:** `evals/results/held-out/2026-11-23-ward-HO-04-t1/`,
  `evals/results/held-out/ward.md` (transcript local, sha256 in
  meta.json).

## 2026-11-23 OSV Maven data for the dependency check (plan 4, step 06)

- **Question:** is downloading OSV's Maven data at check time small and
  fast enough (ADR 0011)?
- **Setup:** `Maven/all.zip` as published 2026-11-20 16:33 GMT; one
  live `analyzeDependencies` run on the example app, then the clean twin.
- **Numbers:** zip 10.6 MB (26 MB unpacked, 7,265 advisories: 7,263
  GHSA, 2 MAL; 122 withdrawn). Ward keeps 7,143 with Maven entries; the
  cache is 4.0 MB. First run (download, unzip, index, match) 2.0 s; next
  run from cache 14 ms. Ranges: 13,587 ECOSYSTEM, 121 SEMVER; events
  include 1,868 `last_affected`; 67 entries list versions only.
- **Result:** EA-19 (Gson 2.8.5) FAIL via GHSA-4jrv-ppp4-jm57 /
  CVE-2022-25647 at `gradle/libs.versions.toml:11`; clean twin (2.15.0)
  no FAIL. Both MANUAL for the rest: 2 Compose libraries get their
  version from a BOM.
- **What it means:** a daily download is cheap; BOM-managed versions
  are the common gap, not data size.
- **Raw data:** none kept (live data changes daily).

## 2026-11-23 Retrieval unchanged by the MCP search tool (plan 4, step 03)

- **Question:** does adding matched/unmatched terms and the MCP tools
  change search ranking?
- **Setup:** `npm run eval:retrieval -- --retriever bm25-tuned`, before
  and after the step's code, same query set and index.
- **Numbers (recall@5 / MRR):** dev 0.938 / 0.811 before and after; test
  0.981 / 0.885 before and after. Results file byte-identical.
- **Sizes:** full `checklist` 48 KB (24 controls, 116 weakness entries,
  195 tests; 81 KB with per-item URLs, which were dropped); `search` k=8
  about 11 KB; largest `get_check` sampled about 7 KB.
- **What it means:** ranking is untouched; the tools only add data.
- **Raw data:** `evals/results/retrieval/bm25-tuned.json`.

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
