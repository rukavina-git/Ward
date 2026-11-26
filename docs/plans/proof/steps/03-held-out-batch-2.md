# 03 Label held-out batch 2

## Goal
20 more real Android security fixes (HO-11 to HO-30), labelled and
frozen before skill v2's held-out run (step 06), so that run has 30
cases instead of 10. Karlo spot-checks.

## Do
1. Selection rules, the same as batch 1
   (docs/plans/mcp-and-analyzers/steps/01-held-out-set.md, items 1–2),
   written down before searching: real fix commits in public Android
   apps (Kotlin or Java, Gradle), fix dated after 2026-06-30 (both
   models' cutoff is June 2026), small and about one issue, static,
   mapped to MASVS/MASWE (MASTG test where one exists) from the pinned
   index. At most 3 cases per repo across both batches; no kind over
   about a third; prefer the harder kinds (absence, dependency, config).
2. Selection bias guard: Claude built Ward and labels the cases. A case
   is kept or dropped by the rules above, never by whether Ward's
   analyzers or skill would find it. Every candidate looked at is
   logged with its outcome and reason in `evals/held-out-batch2-log.md`.
3. Start from batch 1's leftover candidates (key notes), then GitHub
   commit and PR search with the batch 1 keywords, then repository
   security advisories.
4. Answer key `evals/answer-keys/held-out-2.json`: same schema as
   batch 1 (`batch: 2`, IDs HO-11…), its own file so batch 1's pinned
   sha256 doesn't change. Decoys where the parent commit has a
   look-alike that is fine. No code copied: URLs, hashes, paths, lines,
   short anchors, our own words.
5. `heldout:check` takes an optional key path; run it on batch 2.
6. Freeze: `evals/held-out-batch2.md` states the date, counts and the
   key's sha256; a test pins it. Committed before any step 06 run.
7. Tests: the batch 1 key tests also run on batch 2, plus no case ID or
   fix commit in both batches.

## Not in scope
- Wiring batch 2 into the held-out scorer and runner (step 06).
- Any run on the held-out set.

## Done when
- lint, format, typecheck, tests pass; `heldout:check` passes on batch 2.
- Counts per kind, repo and severity in progress.md, with time spent.
- Karlo has spot-checked at least 5 cases (step 06 waits for it).
