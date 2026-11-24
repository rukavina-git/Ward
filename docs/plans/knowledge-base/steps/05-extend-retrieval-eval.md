# 05 Extend the retrieval eval

## Goal
Grow the retrieval query set from 49 to about 150 queries, so a
difference of about 0.05 MRR between two retrievers can show above the
noise. With 17 answerable test queries, one query moving one rank shifts
MRR by about 0.03; with 60 it's under 0.01. Done before vectors (step 06),
so no query is written with vector search in mind. Karlo asked for a
bigger sample (2026-11-23).

## Why now and why this size
- Noise in MRR is roughly 0.35 / √n. 17 test queries: ±0.09. 60: ±0.045.
  Both retrievers run on the same queries (a paired comparison), which
  narrows it further.
- Today's queries hit only 23 of 77 active weaknesses, all from one test
  app's answer key. Search could be poor on the other 54 and the eval
  wouldn't show it.
- Rejected: 300+ queries. Writing and checking each expected ID by hand
  is the cost; 150 gets the noise down where step 06 needs it.

## Do
1. Query file `evals/questions/retrieval.json` goes to version 2. The 49
   v1 queries stay as they are (same IDs, text, expected IDs and split),
   so v1 results stay comparable. New queries continue at `RQ-50`.
2. New queries, all written by Claude in this step, none by Karlo (the
   `notes` say so per origin):
   - `finding` (+35, to about 65): more baseline finding titles from the
     non-smoke planted runs, preferring wordings unlike the ones already
     used, at most 4 per answer key item. Expected IDs from the matched
     answer key item, as in step 03.
   - `missed` (+12, to about 20): answer key items the baseline missed
     or bundled, and absence-style questions ("no way for users to
     delete their account"), rewritten from the planted text.
   - `coverage` (new origin, about 35): one query each for active
     weaknesses not covered by any v1 query, phrased as a developer or
     agent would describe the problem in code ("app trusts all TLS
     certificates in a custom TrustManager"), not copied from the
     title. Expected: the weakness and its tests. These know the corpus
     wording, so they may flatter search; scored apart.
   - `id` (+4, to 10): more ID shapes (control IDs, demo IDs, an ID with
     a typo that must return nothing for that ID).
   - `none` (+15, to 20): Android-adjacent questions the corpus can't
     answer (Play policy wording, GDPR consent text, iOS-only APIs,
     Kotlin style), so plan 4 can measure "nothing found".
3. Every expected ID is checked against the record's text, not just its
   title. Where several records fit, all go in `expected` (a hit is any
   one of them). The `why` line says why.
4. Split. New queries are split about 60/40 dev/test, balanced per
   origin. `finding` and `missed` keep the v1 rule (by answer key item:
   an item already on one side keeps its new queries there). `coverage`
   splits by weakness. The query file test enforces both.
5. Code: add `coverage` to the origins in `evals/src/retrieval.ts`;
   tests updated for the new counts (140–170 queries, every origin in
   both splits, at least 15 `none` and 25 `coverage`).
6. Re-score on v2: `ids`, `bm25`, `bm25-tuned`. Then re-run the BM25 grid
   on v2 dev only. If the best settings change, update `TUNED_SEARCH` and
   report the old and new settings, dev and test, before and after. Test
   is still never used to choose.

## Not in scope
- LLM-generated queries via `claude -p` (no LLM calls in this plan).
- Changing v1 queries or the answer key.
- A "nothing found" cutoff (plan 4).
- Queries from the held-out real-commit set (plan 4 builds it; its
  queries can be added then, as v3).

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- Query file v2 has 140–170 queries; counts per origin and split are in
  progress.md.
- v2 scores for ids, bm25 and bm25-tuned (dev and test, per origin) are
  in progress.md, with the v1 scores next to them.
- Glossary has: standard error (noise in an average), paired comparison.
  Roadmap updated with this step.
