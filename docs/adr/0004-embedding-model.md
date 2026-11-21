# 4. Embedding model

Date: 2026-11-21
Status: Accepted

## What is this
The model that turns text into an embedding. Ward uses it twice: once at
ingestion, for every chunk, and again at search time, for each query.
Both sides must produce embeddings in the same "space" to be comparable.
Usually that means the same model. Some model families share one space
across several sizes.

## Context
Query-time embedding runs where the search runs: on the user's machine
(the local MCP server) and in the browser (the website). ADR 0001 says no
keys, no hosted backend and no code leaving the machine. Ingestion runs
on Karlo's laptop or in GitHub Actions, where an API key would be fine.

## Options
- **bge-small-en-v1.5 (BAAI), local.** Cost: $0.
  - MIT licence (model card). 384 dimensions.
  - Runs on the CPU via Transformers.js, in Node and in the browser.
  - The quantized ONNX file is 34 MB. The ONNX runtime's native files add
    more, to be measured.
  - Con: smaller and weaker than hosted models; English only (fine for
    our sources).
- **all-MiniLM-L6-v2, local.** Cost: $0.
  - Apache 2.0, 384 dimensions, smaller and older.
  - Usually weaker for retrieval. A fallback if speed matters more.
- **Voyage 4 family: API for the corpus, voyage-4-nano locally for
  queries.**
  - The Voyage 4 models share one embedding space, so chunks embedded with
    voyage-4 through the API can be searched with queries embedded by the
    open-weights voyage-4-nano on the user's machine.
  - Cost: $0 in practice. voyage-4 costs $0.06 per 1M tokens, the first
    200M tokens per account are free, and the corpus is about 1M tokens.
  - Pro: possibly better retrieval, with no key needed at query time.
    Voyage is the embeddings provider Anthropic points to.
  - Con: nano's licence (reported Apache 2.0), its size and whether it runs
    in Transformers.js are all unverified.
  - Con: ingestion needs a Voyage key and a paid-API account.
- **Voyage voyage-4 API at query time too.**
  - Rejected: every user query would need a key and the network, which
    breaks ADR 0001.
- **EmbeddingGemma, local.**
  - Released under Google's Gemma terms, not a permissive open licence.
    Rejected under CLAUDE.md's licence rule.

## Decision
Start with bge-small-en-v1.5, quantized and bundled with the package.
Transformers.js runs with remote model loading turned off
(`allowRemoteModels = false`), so it never downloads at runtime.

The choice is confirmed by measurement, not opinion. Plan 3's retrieval
eval (recall@5, MRR) compares bge-small with the Voyage 4 option above,
if nano's licence and size check out.

Before adding any of them, confirm the licences of Transformers.js
(expected Apache 2.0) and of the exact model files we bundle. Record them
in docs/sources.md and the dependency list.

## Consequences
- With bge-small, ingestion embeddings cost $0 and need no account.
- Changing the model means re-embedding the corpus. The index records the
  model id (ADR 0003), so a mismatch is caught at load time.
- Package size grows by the model plus the ONNX runtime. That matters for
  distribution (ADR 0006) and for the website. How the website searches on
  phones is decided in plan 9.

## Sources (checked 2026-11-21)
- bge-small-en-v1.5 licence and files: https://huggingface.co/BAAI/bge-small-en-v1.5,
  https://huggingface.co/Xenova/bge-small-en-v1.5/tree/main/onnx
- Transformers.js local models: https://huggingface.co/docs/transformers.js/en/custom_usage
- Voyage pricing: https://docs.voyageai.com/docs/pricing
- Voyage 4 shared embedding space and nano: https://www.mongodb.com/products/updates/the-voyage-4-series-now-available,
  https://huggingface.co/voyageai/voyage-4-nano
