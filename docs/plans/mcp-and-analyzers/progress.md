# Plan 4 progress

- [x] 01 held-out set and bar, batch 1 (COMMIT)
- [ ] 02 Claude alone on the held-out set (gate)
- [ ] 03 MCP server: knowledge tools
- [ ] 04 manifest analyzer
- [ ] 05 network security config and targetSdk analyzers
- [ ] 06 dependency check (OSV, last, cuttable)
- [ ] 07 use Ward from Claude Code

## Deviations
- Step 01: pilot of 10 (batch 1) instead of 30, as the step file's item 3
  says (Karlo, 2026-11-23). One labelling session.
- Step 01: cases by kind: config 4 (HO-01, 02, 09, 10), code 3 (HO-05, 06,
  07), absence 2 (HO-03, 08), dependency 1 (HO-04). 9 repos, at most 2
  per repo (tasks, talk-android). All 10 fixes dated 2026-07-16 to
  2026-11-02, after both models' June 2026 cutoff. 2 decoys.
- Step 01: anchors carry `lines` plus an optional short `anchor` text
  (like example-app.json); 3 locations have no anchor text (repeated or
  not unique), so heldout:check only checks their lines exist.
- Step 01: only one dependency case. Thunderbird's "OkHttp CVE-2026-11943"
  fix cites an unrelated CVE (OSV lists nothing for OkHttp 5.5.0) and
  FrostWire's netty bump is unconfirmed; both rejected (notes in the key).
- Step 01: the bar's sha256 pin is checked by a test; `heldout:check`
  (network) clones blobless into evals/.cache/held-out and reads with
  `git show` only.

## Gotchas
Carried over: see docs/plans/knowledge-base/progress.md (no "nothing
found" signal; a deprecated test with no replacements returns its empty
`links.tests`, should return itself; `loadIndex` uses node:fs).

Step 01 (reviewer, not fixed; Karlo to decide before step 02, any bar
change must land before the first run):
- The bar's "kinds Ward's analyzers target" list includes HO-03, 08 and
  10, which no planned analyzer covers; only HO-01, 02, 04, 09 are.
- Citation rules overlap: one trial with 3 wrong citations passes
  "Rethink" and triggers "room". Precedence isn't stated.
- The bar lacks the step's "explicit verdicts per control" metric.
- Decoys on 2 cases only; no per-case clean-twin field.
- Note "neither model can have seen it" overclaims: the flawed code is
  older than the fix. HO-04's advisories may predate the cutoff.
- HO-08: MASTG-TEST-0200 is a dynamic test; the case (opt-in plaintext
  export) may be `defensible` rather than FAIL. HO-09 may be hardening.
- HO-10 is a code call, arguably `code` not `config`.
- The kind-mix test allows 40% (step says about a third).
- `locationProblem` counts a trailing newline as a line; a half-finished
  clone in the cache is reused.

Step 01:
- Step 02 needs the runner to check out a repo at a commit (the baseline
  runs a fixture folder). Big repos (Signal) may not fit one run; record
  files inspected.
- Batch 2 candidates are listed in the key's notes.
