# 03 Retrieval eval

## Goal
A fixed test of search quality, written before any search code exists:
40–60 queries, each with the record IDs a good search must return, a
scorer for recall@5 and MRR, and a first score for the only "search" we
have today, exact ID lookup. Steps 04 (BM25) and 05 (vectors) plug into
the same scorer and report dev and test scores before and after.

## Do
1. Query file `evals/questions/retrieval.json`, one JSON file (same idea
   as the answer key: one source of truth). Header: `name`, `version`
   (goes up on any change to queries or expected IDs), `created`,
   `index` (the corpus pins from `packages/core/data/index.json` it was
   written against), `notes`. Each query: `id` (`RQ-01`…), `query` (the
   text, as an agent checking an app would ask it), `expected` (record
   IDs, any kind: weakness, test, control, demo), `origin`, `split`
   (`dev` or `test`), optional `item` (answer key item it came from) and
   `why` (one line: why these IDs).
2. Origins, so the report can say which queries flatter search:
   - `finding` (about 30): seeded from baseline findings in
     `evals/results/example-app/*/findings.json` (non-smoke). The query
     is the finding's title or a short rewrite of its explanation, in
     the finding's own words. Expected IDs come from the answer key item
     the finding matched (its MASWE and MASTG IDs), not from the IDs the
     finding cited, since those can be wrong (MASWE renumbering).
   - `missed` (about 8): answer key issues the baseline arms missed or
     rarely found, written from the item's `planted` text.
   - `id` (about 6): queries that contain an ID (`MASWE-0067`,
     `MASTG-TEST-0039`, a deprecated v1 test, lower case). Expected: that
     record.
   - `none` (about 5): questions the corpus can't answer (iOS keychain,
     GDPR consent wording, a Play listing rule). Expected: empty. Scored
     apart; they show later whether search knows when to return nothing.
   All written by the agent (Claude, in this step), none by Karlo. The
   file says so in `notes`.
3. Split. About 60% dev, 40% test, balanced per origin, chosen once
   while writing and stored in the file. Steps 04–05 tune on dev only;
   test is reported, never tuned on. Rejected: a random split at run
   time (a new seed could move a hard query between sets).
4. Scoring in `evals/src/retrieval.ts`. A retriever is a function from
   query text to a ranked list of chunk or record IDs. Chunk IDs collapse
   to their record, first occurrence wins, so five chunks of one record
   count once. Per query: rank of the first expected record (or none).
   Per split and origin: recall@5 (share of queries with an expected
   record in the top 5) and MRR (mean of 1/rank, 0 if not in the top
   10). `none` queries: how many returned anything at all. Rejected:
   nDCG (needs graded relevance; one "right" set per query is enough
   at this size).
5. Baseline retriever `ids`: find ID-shaped tokens in the query
   (case-insensitive), look each up with core's `get`, return the hits
   in query order. Nothing else. It should ace `id` queries and score
   near zero on the rest: that is the floor steps 04–05 must beat.
6. CLI `npm run eval:retrieval -- --retriever ids` scores both splits,
   prints a short table and writes
   `evals/results/retrieval/<retriever>.json` (query file version,
   index hash, per-query ranks, per-split and per-origin scores). Results
   are committed. evals imports `@ward/core` (it builds after packages).
7. Tests (Vitest):
   - Scorer on hand-made cases: hit at 1, hit at 5, hit at 6 (not in
     recall@5, counts in MRR), miss, chunk IDs collapsing, empty
     expected, duplicate records in the ranking.
   - Query file: schema valid, 40–60 queries, unique IDs and texts,
     every expected ID exists in the committed index and isn't a
     placeholder, each `item` exists in the answer key, both splits have
     every origin, `none` queries have no expected IDs.
   - `ids` retriever: finds IDs in mixed case and inside sentences,
     ignores unknown IDs.

## Not in scope
- Any search beyond ID lookup: tokenizer, BM25 (step 04), vectors (05).
- LLM-written or LLM-judged queries (no LLM calls in this plan).
- Graph walks as a retriever (a control query returning its tests);
  plan 4 decides how tools combine lookup and search.
- Changing the answer key.

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- `npm run eval:retrieval -- --retriever ids` writes its result; the
  dev and test scores (recall@5, MRR, per origin) are in progress.md.
- Query count per origin and split is in progress.md.
- Glossary has: query set, relevance labels (qrels), dev/test split,
  retriever. Roadmap "Retrieval eval" ticked.
