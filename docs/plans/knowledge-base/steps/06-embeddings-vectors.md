# 06 Embeddings and vector search by hand

## Goal
Embed every chunk with bge-small-en-v1.5 (ADR 0004), search by
brute-force cosine, and merge with BM25 (hybrid), all by hand. Compare
`bm25-tuned`, `vectors` and `hybrid` on the retrieval eval: tune on dev,
score test once. Vectors ship only if they win by a rule written down
here, before any vector is computed (ADR 0009). Record the decision in
ADR 0010 either way.

## Do
1. Fix RQ-110 first (step 05 reviewer): check MASTG-TEST-0340 and
   DEMO-0103..0105 against their text, add the ones that fit to
   `expected`, bump the query file to version 3, and re-score `ids`,
   `bm25` and `bm25-tuned` on v3. This is done before any vector code,
   so the fix can't be chosen to help vectors. No other query changes.
2. Licences before install. Check and record in docs/sources.md and the
   dependency list: `@huggingface/transformers` (expected Apache 2.0),
   `onnxruntime-node` and anything it pulls in natively (expected MIT),
   `sharp` if it comes along, and the model files at
   `Xenova/bge-small-en-v1.5` (expected MIT, from BAAI). Stop and ask if
   any is not permissive. Pin the package version exactly and the model
   to a Hugging Face commit hash; record the quantized ONNX file's
   SHA-256.
3. Embedding, in packages/ingest (`embed.ts`), so core gets no model
   dependency unless vectors ship. A script downloads the pinned model
   files once into a gitignored cache and checks the hash; embedding
   then runs with `allowRemoteModels = false`. Each chunk is embedded as
   title + section + text (the same text BM25 indexes), CLS pooling and
   L2 normalisation (as the model card says), quantized model. Chunks
   over 512 tokens are cut by the model; count how many and note it.
   Queries get bge's query instruction ("Represent this sentence for
   searching relevant passages: "), on/off as a dev experiment.
   Vectors go to `packages/ingest/out/vectors.bin` (Float32, chunk order
   of index.json) plus a small JSON header (model id, revision,
   dimensions, chunk count, index hash). Gitignored in this step.
   Rejected: committing vectors now (only if they win, then a format
   bump in a follow-up); fp32 model (bigger, ADR 0004 chose quantized).
4. Vector search in packages/core (`vectors.ts`), pure code, no model:
   dot product of normalised vectors (= cosine), brute force over all
   chunks, top k, ties by chunk ID, placeholders left out as in BM25.
   Hybrid: reciprocal rank fusion (RRF) of the BM25 and vector rankings,
   `k` from dev (10/30/60) and an optional vector weight (0.5/1/2). ID
   lookup stays on top, as in BM25 search. Rejected: summing raw scores
   (BM25 and cosine are on different scales; would need normalisation
   that's fragile on 98 dev queries).
5. Eval. Retrievers become async-capable (`string[] |
   Promise<string[]>`); query vectors are computed once per run and
   cached in memory. Add `vectors`, `hybrid` (defaults) and
   `hybrid-tuned` to `evals/src/retrieval.ts`. A small dev grid (query
   instruction on/off, RRF k, vector weight), top 10 printed, chosen
   settings as named constants with a "from dev" comment. For `none`
   queries record the top cosine next to real queries' top cosine, for
   plan 4's "nothing found" cutoff. Report per origin.
6. Decision rule (pre-registered, fixed now): on the v3 test split, all
   answerable queries, `vectors` or `hybrid-tuned` ships if its MRR beats
   `bm25-tuned` and a paired bootstrap (10,000 resamples of test queries,
   fixed seed) gives a 95% interval for the MRR difference above 0, and
   recall@5 isn't lower and `id` queries stay 1.0. Otherwise BM25 alone
   ships. Coverage queries are shown apart too, since they know the
   corpus wording.
7. ADR 0010 "Vectors: ship or not", with the scores, the interval, model
   size on disk and embedding time for the corpus and per query. If they
   ship, the follow-up (format bump, `embedding` field, vectors file in
   core/data, LICENSE coverage, browser loader) is a new step, not this
   one.
8. Tests (Vitest):
   - Cosine and top-k on tiny hand-made vectors: order, ties by ID,
     placeholders skipped, empty query vector returns nothing.
   - RRF on hand-made rankings with hand-computed scores; an item in one
     list only; weight applied.
   - Bootstrap: fixed seed gives the same interval; identical scores give
     an interval of [0, 0].
   - Embedding (skipped when the model cache is missing, so CI doesn't
     download): 384 dimensions, norm 1, same text gives the same vector,
     "certificate pinning" closer to "TLS pinning bypass" than to "SQL
     injection".
   - Vectors header matches the index (chunk count, index hash).

## Not in scope
- Shipping vectors in core/data, the MCP server or the browser (a
  follow-up step if they win; plan 9 for the website).
- Other models (MiniLM, Voyage): Voyage needs a key (ADR 0007).
- Approximate indexes (HNSW): brute force is enough (ADR 0003).
- Changing chunking or BM25 settings. A "nothing found" cutoff (plan 4).
- LLM calls of any kind (rerankers, query rewriting).

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- progress.md has v3 dev and test recall@5 and MRR, per origin, for
  ids, bm25, bm25-tuned, vectors, hybrid and hybrid-tuned; the chosen
  settings; the bootstrap interval; the none-query cosines; model size
  and embedding time.
- Licences recorded in docs/sources.md; ADR 0010 written with the
  decision.
- Glossary has: pooling (CLS), L2 normalisation, query instruction
  (asymmetric retrieval), reciprocal rank fusion, bootstrap (confidence
  interval), token limit / truncation. Roadmap "vectors" ticked.
