# Plan 3: knowledge base (first RAG)

## Why
Ward's checks and citations need the OWASP sources as data: every
control, weakness and test with its exact ID, its text and a link back.
This plan builds that knowledge base and the search over it, by hand.

ADR 0009 changed the order of trust. Exact ID lookup and keyword search
(BM25) come first, because a citation must be exact. Vectors are built
too, by hand, but they ship only if they beat BM25 on the retrieval eval.
Either outcome is a result worth publishing.

## Read first
CLAUDE.md, PRODUCT.md, docs/adr/0002-language-and-layout.md,
docs/adr/0003-retrieval-storage.md, docs/adr/0004-embedding-model.md,
docs/adr/0009-precision-and-evidence.md, the MASWE renumbering gotcha in
docs/plans/example-app-baseline/progress.md, and the glossary entries
Chunk, Corpus, BM25, Embedding, Recall@k, MRR, Hybrid search and
Ablation.

## Steps
- 01 Sources and ingest. Download MASVS, MASWE and MASTG at pinned tags
  and commits. Parse them into records by ID and link the graph: control
  → MASWE → test → demo, translating MASWE beta IDs. Each record keeps
  its source URL, version and licence. Create packages/ingest and
  docs/sources.md.
- 02 Chunks, index file and ID lookup. Split records into chunks, write
  the index file in ADR 0003's format (vectors left out for now), ship
  the data's LICENSE and NOTICE. In packages/core: look up by ID and walk
  the graph (e.g. a control's tests).
- 03 Retrieval eval. 40–60 queries with expected IDs, many seeded from
  the baseline runs' findings (written by the agent, not by Karlo).
  Split into dev and test. A scorer for recall@5 and MRR, with tests.
  First score: ID lookup only.
- 04 BM25 by hand. Tokenizer that keeps IDs whole, BM25 scoring, search
  in packages/core. Tune on dev, report test, before and after.
- 05 Embeddings and vector search by hand. bge-small-en-v1.5 via
  Transformers.js (licences checked first), brute-force cosine, hybrid
  merge. Compare BM25, vectors and hybrid on test. Ship vectors only if
  they win; record the decision either way.

Step files are written one at a time, each after the previous step lands.
The roadmap put BM25 before the eval. Here the eval comes first, so the
queries are fixed before any search code exists (same idea as plan 2's
answer key before the app).

## Invariants
- RAG pieces by hand: chunking, BM25, vector search, ranking. No
  LangChain, LlamaIndex or search libraries (lunr, MiniSearch and
  similar). A markdown or YAML parser is fine if permissive.
- Every record and chunk keeps origin URL at the pinned tag, version and
  licence. Citations are built from these fields, never generated.
- Ingest is reproducible: the same pinned sources give a byte-identical
  index.
- The data is CC BY-SA 4.0 with its own LICENSE and NOTICE; the code
  stays MIT (ADR 0003).
- Source text is untrusted input: stored and searched as data, never
  executed or followed. MASTG code samples are text.
- No LLM calls in this plan. If one becomes needed, its prompt goes in
  prompts/ and it runs through `claude -p` (ADR 0007).
- Retrieval eval queries are fixed before search code is tuned. Every
  retrieval or chunking change reports dev and test scores before and
  after.
- No MCP tools yet (plan 4). This plan ends at a tested library.
- packages/ingest imports core, so it builds after it (alphabetical
  order works: core < ingest).

## Risk
- MASTG's markdown and front matter change between versions; the parser
  may break on the next release. Pin, and test on real files.
- A wrong graph link gives a wrong citation (MASWE renumbering,
  MASTG-TEST-0334's mapping). Test the known mappings.
- Queries Karlo writes know the corpus, which flatters search. Seeding
  from agent findings reduces this; say which queries are which.
- Vectors may lose to BM25. That's a valid result and gets published.
