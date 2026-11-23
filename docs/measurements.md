# Measurements

Every number Ward has measured, in one place, newest first. Each entry:
date, what was measured, setup, the numbers, what it means, and where the
raw data is. Later overviews (site, PDF, write-ups) are built from this
file, so add an entry whenever something is measured, including failures
and results that look bad for Ward.

"$" is the API-equivalent Claude Code reports. Runs are on Karlo's Pro
plan, not billed (ADR 0007).

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
