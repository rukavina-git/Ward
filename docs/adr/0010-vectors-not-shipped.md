# 10. Vectors: not shipped; BM25 alone

Date: 2026-11-23
Status: Accepted

## Context
ADR 0009 made vector search conditional: it ships only if it beats BM25
on the retrieval eval. Plan 3 step 06 built it by hand (bge-small-en-v1.5,
brute-force cosine, reciprocal rank fusion with BM25) and fixed the rule
before computing any vector: on the test split (query set v3, 54
answerable queries), the challenger wins if its MRR is higher, a paired
bootstrap's 95% interval for the MRR difference is above 0, recall@5 isn't
lower, and `id` queries stay at 1.0.

The library also changed. ADR 0004 named Transformers.js, but it pulls in
sharp, whose native libvips binary is LGPL-3.0 (not on CLAUDE.md's
licence list). Ward calls `onnxruntime-node` (MIT) and
`@huggingface/tokenizers` (Apache 2.0) directly instead, and does pooling
and normalisation by hand. Karlo chose this on 2026-11-23.

## Results (test, v3; dev tuned only)
| Retriever | recall@5 | MRR | MRR vs bm25-tuned, 95% interval |
| --- | --- | --- | --- |
| bm25-tuned | 0.981 | 0.885 | – |
| vectors | 0.926 | 0.699 | −0.186 [−0.292, −0.076] |
| hybrid (k 60, equal) | 0.926 | 0.824 | not run (untuned) |
| hybrid-tuned (k 10, vector weight 0.5) | 0.963 | 0.834 | −0.051 [−0.107, 0.004] |

On dev, hybrid-tuned had higher recall@5 than BM25 (0.963 vs 0.938) but
lower MRR (0.803 vs 0.811). The dev grid's best point gave vectors the
least weight it allowed: the more weight vectors get, the worse the
ranking. Vectors alone did worst on `missed` queries (dev MRR 0.334, BM25
0.843), where the right record shares exact words with the query.

Cost: the quantized model is 34 MB; `onnxruntime-node` is 287 MB
installed (every platform's binaries). Embedding the 2,132 chunks takes 63
s on one CPU thread (29 ms per chunk); a query takes 2.5 ms. 123 chunks
are longer than the model's 512 word pieces and get cut. The vectors file
(3.2 MB) builds byte-identically.

## Options
- **Ship BM25 alone.** Exact, small, no model in the package. Meets the
  rule's baseline.
- **Ship hybrid anyway, for recall.** It lost on MRR and its test
  recall@5 is lower too; the rule says no.
- **Keep tuning vectors (more weights, other models, other chunk
  text).** Tuning until it wins on dev would overfit 80 queries; the rule
  was fixed first so this can't happen quietly.

## Decision
BM25 alone (with ID lookup first) ships. No vectors, model or ONNX runtime
in `@ward/core`, the MCP server or the website. The vector code stays: core's
`VectorSearch`, `reciprocalRankFusion` and `hybridSearch` are pure and
tested; ingest's embedder and `npm run embed` stay as eval tooling, so the
comparison can be rerun.

## Consequences
- Package and site stay small; no model download, no native runtime for
  users (ADR 0006 gets easier).
- "Nothing found" needs a non-vector signal: the top cosine didn't
  separate the none queries either (dev: none 0.591–0.762, answerable
  0.610–0.855). Plan 4 decides with BM25 score ratios or similar.
- Revisit when the held-out real-commit queries (plan 4) exist, or when
  the corpus adds sources whose wording differs from the queries (iOS,
  privacy): vectors help most when words don't match, and these queries
  mostly share words with OWASP's text. Rerun with `npm run embed`,
  `npm run eval:tune-hybrid` and `npm run eval:compare`.
- ADR 0004's model choice stands; its library choice (Transformers.js) is
  replaced as above.

## Sources (checked 2026-11-23)
- Model and licence: https://huggingface.co/BAAI/bge-small-en-v1.5 (MIT),
  ONNX files at https://huggingface.co/Xenova/bge-small-en-v1.5, commit
  ea104dacec62c0de699686887e3f920caeb4f3e3
- Licences from the npm registry: onnxruntime-node 1.30.0 (MIT),
  @huggingface/tokenizers 0.2.0 (Apache-2.0), sharp 0.35.4 (Apache-2.0)
  with @img/sharp-libvips-* (LGPL-3.0-or-later)
- Results: evals/results/retrieval/*.json, hybrid-tuning.json
