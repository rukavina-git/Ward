# Plan 3 progress

- [x] 01 sources and ingest (4fe6225, CI green:
  https://github.com/rukavina-git/Ward/actions/runs/44995159280)
- [x] 02 chunks, index file and ID lookup (5ce8970)
- [x] 03 retrieval eval (0b7f82c)
- [x] 04 BM25 by hand (d45ded6)
- [x] 05 extend the retrieval eval (~150 queries) (d682549)
- [ ] 06 embeddings and vector search by hand

## Deviations
- Step 01: the overrides were drafted in an earlier session and approved
  by Karlo when this step was run (6 overrides: TEST-0206, 0307, 0308,
  0324, 0325, 0334).
- Step 01: ingest prints 98 active v2 tests + 14 placeholders (= 112)
  and 89 active demos + 5 placeholders (= 94), as the step expects.

- Step 02: the four walk functions became one, `related(id, kind)`, on a
  `KnowledgeBase` class; `get(id)` is the step's `getRecord`.
- Step 02: the index has no build date (ADR 0003 asks for one): it would
  break byte-identical builds; the pinned commits date it.
- Step 02: deprecated v1 tests ship only a summary chunk (title and
  replacements); their old text stays in records.json, not in the index.
- Step 02: result: 2,132 chunks (demo 1,268, test 490, weakness 326,
  control 48); text median 607 chars, p90 1,475, max 4,064; 8 chunks
  over the limit, all single long lines in decompiled Java. Index 2.8 MB.

- Step 03: the step file was written in this session (none existed) and
  approved by Karlo before work began.
- Step 03: `missed` also covers items only ever reported bundled with
  another (EA-06, 07, 13, 21), not just items some runs missed.
- Step 03: the split is by answer key item (all of an item's queries on
  one side), which the step file didn't require; a test enforces it.
- Step 03: 49 queries. dev 30 (finding 18, missed 5, id 4, none 3),
  test 19 (finding 12, missed 3, id 2, none 2).
- Step 03: first score, `ids` retriever. dev: recall@5 0.148, MRR 0.148
  (id 1.0, finding 0, missed 0; none: 0 of 3 returned anything). test:
  recall@5 0.118, MRR 0.118 (id 1.0, others 0; none: 0 of 2).

- Step 05: 154 queries (v1 49 + 105). dev 98: finding 39, missed 12,
  coverage 23, id 6, none 12 (+6). test 56: finding 26, missed 8,
  coverage 16, id 4, none 8 (+2).
- Step 05: coverage got 39 of 54 uncovered weaknesses, not all; the 15
  skipped are listed in the query file's notes.
- Step 05: EA-15 had no v1 query; its new queries went to test (with
  EA-14, which it's always reported with).
- Step 05: added a test that finding/missed queries expect their item's
  own MASWE and MASTG IDs (a step 03 reviewer note).
- Step 05: scores, v1 → v2 (all answerable queries, recall@5 / MRR).
  ids dev 0.148/0.148 → 0.063/0.063; test 0.118/0.118 → 0.074/0.074.
  bm25 dev 0.778/0.568 → 0.875/0.657; test 0.882/0.708 → 0.889/0.708.
  bm25-tuned (old b 0.75) dev 0.889/0.785 → 0.938/0.799; test
  1.000/0.845 → 0.981/0.854.
- Step 05: v2 per origin, bm25-tuned (old b 0.75), MRR dev / test:
  finding 0.751/0.891, missed 0.802/0.681, coverage 0.826/0.844, id 1/1.
  bm25 MRR dev / test: finding 0.518/0.676, missed 0.618/0.604, coverage
  0.824/0.740. none: every BM25 run returned something for all 20.
- Step 05: grid rerun on v2 dev picked b 0.5 (was 0.75; k1 0.9, stem,
  title 1, code 0.5 unchanged). dev MRR 0.799 → 0.803, recall@5 0.938
  both; test MRR 0.854 → 0.885, recall@5 0.981 both. The dev gain is one
  query's worth, within noise; updated only because step item 6 says so.

## Gotchas
Carried over: see docs/plans/foundations/progress.md and
docs/plans/example-app-baseline/progress.md (MASWE renumbering, Node on
PATH, `claude -p` isolation).

Step 01 (reviewer, not fixed):
- `git -c core.symlinks=false clone` doesn't save the setting in the
  clone, so `git status` there runs with symlinks on. No pinned repo has
  symlinks today. After a pin bump, use `clone --config` or pass `-c` to
  status.
- The known-mappings check doesn't assert exactly 18 issues; an answer
  key edit could quietly shrink it.
- A failed ingest leaves the old `out/records.json` in place. Step 02
  should write to a temp file and rename it only on success.
- A demo may link to a deprecated v1 test and pass the check.
- The control statement regex reads one line; a wrapped statement
  would be cut short.
- `records.json` lives in `packages/ingest/out/` (gitignored). Step 02
  reads it from there; the `Record` type is in `packages/core/src/records.ts`.

Step 02:
- 60% of chunks are demo code (1,268 of 2,132), many tiny (a secret
  file, one shell line). BM25 (step 04) may need to down-weight or
  filter code chunks, or merge tiny ones; decide on the dev set.
- Demo sample sections often hold only an include
  (`{{ MastgTest.kt # ... }}`); the code is in the file chunks.
- The index is committed and prettier-ignored. After a pin bump, rerun
  `npm run ingest` and commit `packages/core/data/index.json`;
  `data.test.ts` pins the counts and the 18 known mappings.
- `loadIndex` uses node:fs; the browser (site) will need its own loader.
- The 1,500-char limit is duplicated in `data.test.ts` (core can't import
  ingest).

Step 02 (reviewer, not fixed):
- A deprecated test with no replacements (4 of them) asked for its own
  kind returns its `links.tests` (empty), not itself. Plan 4 should
  return the record itself.
- records.json is written before the index; if the index write fails
  the two disagree, and a failed write leaves a `.tmp` file.
- The fence check treats a fence with an info string as a closing fence
  (CommonMark doesn't). No effect on current data.
- The heading regex strips a trailing `#` ("## C#" gives "C").
- The over-limit check doesn't list the 8 chunk IDs it allows.

Step 03:
- Add a retriever by adding it to `retrievers` in
  `evals/src/retrieval.ts`; `npm run eval:retrieval -- --retriever <name>`
  writes `evals/results/retrieval/<name>.json`. Tune on dev only.
- EA-16 (test) and EA-17 (dev) share MASWE-0063, so one expected ID sits
  on both sides even though items don't.
- The `ids` score (dev 0.148, test 0.118) is the floor; BM25 must keep
  id queries at 1.0. The query file checks its index pins: a pin bump
  fails the CLI until the queries are rechecked.

Step 04:
- Raw BM25 scores can't say "nothing relevant": dev `none` queries top
  at 10.3–20.3, real queries at 5.5–32.9. Plan 4 needs another signal
  (e.g. score ratio, or vectors in step 05) before a cutoff.
- Step 05 compares against `bm25-tuned` (test 1.000 / 0.845). Test
  recall@5 is already at the ceiling; MRR is the score left to win.
- Gains came from stemming and halving demo code scores. Tuned on 27
  dev queries, so a 0.02 MRR gap is one query; don't read small diffs.
- `KnowledgeBase.search` builds the BM25 index lazily, one per set of
  indexing options (stopwords, stem, titleWeight); k1, b and codeWeight
  apply at query time.

Step 04 (reviewer, not fixed):
- `idPattern` is an exported `/g` regex: safe with `matchAll`, but
  `.test()` or `.exec()` on it would carry state between calls.
- The stemmer is uneven: "cookies" → "cooky" but "cookie" stays; "uses"
  → "use" but "used" stays.
- `isCodeChunk` treats any demo section ending in `.\w+` as a file; a
  heading like "Frida 16.1" would be down-weighted too.
- A non-integer `titleWeight` rounds up (1.5 indexes the title twice).

Step 03 (reviewer, not fixed):
- RQ-31 (EA-09) and RQ-36 (EA-08) are `missed`, but the baseline found
  those items in 8 of 9 runs; they may flatter the missed group.
- No test checks that a query's `expected` equals its item's MASWE and
  MASTG IDs in the answer key; they match today (checked by script).

Step 05:
- Step 06 compares against `bm25-tuned` with b 0.5: v2 test recall@5
  0.981, MRR 0.885 (dev 0.938 / 0.803). Coverage queries are scored
  apart; they know the corpus wording.
- ids' id-origin MRR is 0.833 on dev because RQ-137 (typo ID) expects
  MASTG-TEST-0226 for text search; ids correctly returns nothing.

Step 05 (reviewer, not fixed):
- RQ-110 (tapjacking) expects only MASWE-0039, but MASTG-TEST-0340 and
  DEMO-0103..0105 are about overlay protection too (the index links
  TEST-0340 to MASWE-0036). Tuned BM25 ranks them 1–2, so the query
  scores rank 3. Fix in a v3 or before step 06 scores.
- The coverage test checks only `expected[0]`; "weakness plus its active
  Android tests" isn't enforced, so an index bump could leave it stale.
