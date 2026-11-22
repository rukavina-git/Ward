# Plan 3 progress

- [x] 01 sources and ingest (4fe6225, CI green:
  https://github.com/rukavina-git/Ward/actions/runs/44995159280)
- [x] 02 chunks, index file and ID lookup (5ce8970)
- [ ] 03 retrieval eval
- [ ] 04 BM25 by hand
- [ ] 05 embeddings and vector search by hand

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
