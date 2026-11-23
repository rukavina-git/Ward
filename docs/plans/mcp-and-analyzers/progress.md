# Plan 4 progress

- [x] 01 held-out set and bar, batch 1 (f4c8c92)
- [x] 02 Claude alone on the held-out set (gate) (6db3168)
- [x] 03 MCP server: knowledge tools (b88ad60)
- [x] 04 manifest analyzer (969a879)
- [x] 05 network security config and targetSdk analyzers (HASH)
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
- Step 02: minimal gate instead of 60 runs (Karlo, to save plan usage):
  Sonnet 5.5 only, one trial, parent commits only, 10 runs. Bar changed
  before any run (b0b83e2): re-flags on fix, disagreement and
  verdicts-per-control dropped; "harder kinds" named honestly; room wins.
- Step 02: result: **Ward has room**. Found 3 of 10 (HO-01 via a generic
  finding), 4 of 7 harder kinds missed, 25 of 83 citations wrong (18 of
  19 MASWE). Decision (Karlo): continue. Details: gate.md and
  docs/measurements.md (new: the log of every measurement).
- Step 02: labels proposed by Claude, accepted by Karlo in bulk; no
  separate spot-check of cases. The 53 other findings are listed in
  grades.json but not graded (the bar says graded by hand); they don't
  affect the outcome. MASTG IDs aren't checked: the findings schema has
  no MASTG field.
- Step 02: Git LFS isn't installed, so the export disables LFS filters
  (LFS files stay as pointer text). Two runs (HO-03, HO-08) first failed
  at export before Claude started; their empty folders were removed and
  the runs redone.
- Step 02: roadmap "Held-out eval set" ticked with 10 of the planned 30.
- Step 03: checklist entries carry no URL (full list 81 KB → 48 KB,
  about 12k tokens, under Claude Code's 25k MCP output limit); get_check
  gives the citation. No MCP outputSchema: structuredContent plus the
  same JSON as text. matchedTerms comes from `KnowledgeBase.matchedTerms`
  (not a SearchHit field), so the eval's search path is untouched. Tool
  annotations (read-only) added. "Claude Code lists the three tools" is
  checked by the stdio test; the live `/mcp` reconnect is Karlo's.

- Step 04: exported activities, services and receivers are MANUAL, not
  FAIL (the launcher and the clean twin's deep link are decoys in the
  answer key). Exported providers with no permission are FAIL, mapped to
  MASTG-TEST-0355/0357 (not in the step file; the key uses 0355).
  Dangerous permissions are MANUAL. Debuggable is MANUAL in source mode
  (isDebuggable lives in Gradle). Hand-written test manifests are built in
  temp folders, not committed test data. The tool lists only exported
  components (others counted). Any DOCTYPE is rejected outright. Server
  version 0.2.0. Dangerous-permission list read from the Android docs
  2026-11-23 (partly from a summarised fetch).

- Step 05: also reads the release build type's isDebuggable from Gradle
  (EA-17 now FAIL in source mode, was MANUAL). The manifest tool lost its
  cleartext verdict; `network` owns it. Shared tool code moved to
  packages/mcp/src/app-tool.ts; the notice now covers all analyzers.
  manifest-tool.test.ts renamed analyzer-tools.test.ts. Server 0.3.0.
  Play's rule (API 36 since 2026-08-31) checked on the live page
  2026-11-23. targetSdk verdict cites MASWE-0042 (no MASTG test exists).

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

Step 02 (reviewer, not fixed):
- run-cli creates the result folder before the export, outside the try:
  a failed export leaves a folder with no meta.json, and the rerun then
  refuses ("already exists"). Delete the empty folder by hand.
- No tests for `tally`'s provisional flag or for a decoy label
  overriding its proposal.
- `git archive` honours a repo's export-ignore/export-subst attributes
  (root ones checked for all 10 parents: none).
- A case with no ok run is neither found nor missed, but the bar counts
  "of 10".

Step 02:
- Runs are cheap: 21 to 51 s, about 1.6 points of the 5-hour window
  each. Claude alone reads only 4 to 11 files, even in Signal.
- Claude's MASWE IDs look consistent but are wrong for v1.0.0; any
  citation check must compare against the pinned index, not trust IDs.
- Step 03 onward: Ward must never be tuned on HO-01…HO-10.

Step 03 (reviewer NITs, not fixed):
- `checklist` filters tests by profile and status, not platform; "no
  iOS tests" holds only because ingest drops them (guarded by the tools
  test on the real index, not a core test).
- `inProfile` keeps a record whose `profiles` isn't an array; use
  `strings()` there if the data ever has a scalar.
- get_check echoes `id`, search echoes `query` outside `text` fields;
  the notice names only `text` as untrusted.

Step 03:
- The mcp package reads core's built types: rebuild core
  (`npm run build -w @ward/core`) before typechecking mcp after core edits.
- Tools load `packages/core/data/index.json` relative to core's dist;
  step 04's analyzers add their own tools to `server.ts` the same way.
- Claude Code caps MCP output at about 25k tokens; keep each tool's
  result well under it (checklist is about 12k).

Step 04 (reviewer, BLOCKER fixed: a launcher activity with a deep link
was skipped; now only MAIN/LAUNCHER-only components are). Not fixed:
- A redeclared component replaces its intent filters (Gradle merges
  them); an overlay can hide an exported activity.
- Application attributes: last file wins across modules and flavors
  (phone + wear, `staging` overriding `prod`): a NO FINDING can hide one
  exposed module. Facts per module, or MANUAL when they disagree.
- Hitting the walk cap only adds a limit; NO FINDING should drop to
  MANUAL as with parse errors.
- `build/intermediates` and `merged_manifests` aren't lstat'ed before
  readdir: a symlinked build folder is followed out of the root.
- `detail` strings carry app names and paths with no length cap.
- Merged-mode debuggable relies on AGP writing android:debuggable into
  merged_manifests: true for the fixture's real AGP build (line 35), not
  checked on other AGP versions.
- NITs: any android:permission counts as protection (protectionLevel
  normal doesn't protect); `^test` drops flavors like testnet; readdir
  errors are silent; nameless components collapse into one.

Step 04:
- Fixture build/ is gitignored: CI tests source mode only; merged mode is
  tested with hand-written build folders.
- Step 05 should read targetSdk from Gradle: in source mode targetSdk is
  usually unknown, so cleartext and implied-exported stay MANUAL.
- The `cleartext` verdict defers to step 05 whenever a network security
  config is set.

Step 05 (reviewer: no BLOCKER; SHOULDs not fixed, all false-NO-FINDING
risks, fix early in plan 5 or before the eval):
- isDebuggable read only as a literal true/false inside `release {}`;
  a non-literal value, `getByName("release").isDebuggable = true`, or
  `all {}` / `configureEach {}` gives NO FINDING. Should be MANUAL.
- findXml ranks any non-debug source set (a flavor, `staging`) above
  main: another flavor's strict NSC can give NO FINDING. Downgrade when
  candidates from different sets disagree.
- user-ca says NO FINDING for user CAs in debug-overrides without
  checking the release build isn't debuggable (EA-17 style).
- NITs: `repeated` SDK keys unused (a flavor's lower targetSdk is
  missed); stripComments ignores strings (`"META-INF/*"` can blank
  code); a manifest's <uses-sdk> wins over Gradle (AGP does the
  opposite); pinning NO FINDING even if every pin-set is expired or
  empty; expired + malformed dates drops the expired evidence; a
  placeholder usesCleartextTraffic skips the minSdk<24 check.

Step 05:
- Each analyzer re-runs analyzeManifest unless given `{ manifest }`; the
  tools call them separately (three walks per full check). Fine for now.
- Step 07's agent needs `projectRoot` as an absolute path; the held-out
  export folder works.
