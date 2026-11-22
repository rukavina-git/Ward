# Plan 3 progress

- [x] 01 sources and ingest (4fe6225, CI green:
  https://github.com/rukavina-git/Ward/actions/runs/44995159280)
- [ ] 02 chunks, index file and ID lookup
- [ ] 03 retrieval eval
- [ ] 04 BM25 by hand
- [ ] 05 embeddings and vector search by hand

## Deviations
- Step 01: the overrides were drafted in an earlier session and approved
  by Karlo when this step was run (6 overrides: TEST-0206, 0307, 0308,
  0324, 0325, 0334).
- Step 01: ingest prints 98 active v2 tests + 14 placeholders (= 112)
  and 89 active demos + 5 placeholders (= 94), as the step expects.

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
