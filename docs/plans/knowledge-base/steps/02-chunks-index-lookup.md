# 02 Chunks, index file and ID lookup

## Goal
Turn step 01's records into the shipped knowledge base: records split
into chunks, written to one index file in ADR 0003's format (no vectors
yet), with the data's own LICENSE and NOTICE. In packages/core, load the
index, look up any ID and walk the graph (a control's weaknesses and
tests, a test's controls, an old v1 test's replacements). No search yet:
the retrieval eval (step 03) comes before any ranking code.

## Do
1. Chunking, by structure. Each record body is split at its `##`
   headings: one chunk per section (Overview, Steps, Evaluation,
   Mitigations…). Text before the first `##` is its own chunk. A section
   longer than 1,500 characters (about 375 tokens, well under
   bge-small's 512-token limit for step 05) is split at blank lines,
   never inside a fenced code block unless one block alone is too long;
   then it's split at line breaks. Rejected: fixed-size windows with
   overlap (they cut through sentences and lose which section a piece
   belongs to; MASTG's sections already carry meaning).
2. Chunks for the other kinds of text:
   - Controls: the `## Control` statement and `## Description` as above.
   - Demo code and output files: one chunk per file (split at line
     breaks if long), section path = the file name. Kept as text, never
     run.
   - Deprecated v1 tests: one small chunk (title plus "covered by …").
   - Placeholders: one chunk with title and status, so lookup finds the
     ID; search can filter them out later.
3. Chunk shape (ADR 0003): `id` (`<record id>#<n>`, stable for the
   same input), `record` (the record ID), `kind`, `status`, `section`
   (heading path, e.g. `["Steps"]` or `["sample.kt"]`), `text`, and the
   citation fields from the record: source URL at the tag (with a
   `#anchor` for the heading where GitHub makes one), version, licence.
   Chunk text is the section text only; title and section live in their
   own fields so step 04 can weigh them separately.
4. Index file `packages/core/data/index.json`, committed (so CI and
   users never need the 60 MB download). Top level: `format`, corpus
   (the three pinned sources with commit), `embedding: null` (step 05
   fills it or leaves it null), records without their bodies (id, kind,
   title, status, fields, links, source, chunk ids), and the chunks.
   Bodies live once, in the chunks. ADR 0003 asks for a build date;
   it's left out because the index must be byte-identical across runs
   (the pinned commits already date it). Written to a temp file and
   renamed only on success (step 01 gotcha). `npm run ingest` writes
   both records.json and the index.
5. Data licence: `packages/core/data/LICENSE` (CC BY-SA 4.0 full text)
   and `NOTICE` (credits OWASP MAS, links the three repos at their tags,
   says the text was split into chunks and front matter reshaped). Core's
   `package.json` licence becomes `MIT AND CC-BY-SA-4.0`. docs/sources.md
   says where the data ships.
6. Lookup in packages/core (pure functions over the loaded index, no
   I/O except `loadIndex`):
   - `loadIndex(path?)` reads and validates the format version.
   - `getRecord(id)`: case-insensitive exact match, returns the record
     and its chunks in order; unknown ID returns nothing (never a
     guess).
   - Graph walks: `controlsFor(id)`, `weaknessesFor(id)`, `testsFor(id)`,
     `demosFor(id)`, working from any kind (a control's tests go through
     its weaknesses). A deprecated v1 test resolves to its `coveredBy`
     tests, marked as a redirect.
   - Results sorted by ID, so callers get the same order every time.
7. Tests (Vitest):
   - Chunker on small inline inputs: sections, preamble, long section
     split at blank lines, code fence kept whole, code files, stable IDs,
     anchors.
   - Lookup on a tiny hand-made index: exact and case-insensitive hit,
     miss, each walk, redirect.
   - On the real committed index: format, counts per kind match step
     01, every chunk's record exists and every record has a chunk, no
     chunk over the limit (except a single oversized line, reported),
     every chunk has URL, version and licence, and the 18 known mappings
     hold through the core walks (control → test).
   - Reproducible: building the index twice from the step 01 fixtures
     gives the same bytes.

## Not in scope
- Search of any kind, tokenizer, BM25 (step 04), vectors (step 05).
- The retrieval eval (step 03).
- MCP tools that use the lookup (plan 4). Core's `hello` stays.
- A CI job that runs ingest (still needs the 60 MB download). CI tests
  the committed index instead; a pin bump reruns ingest locally.
- KNOW, BEST, techniques and tools as records.

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- `npm run ingest` writes the index; two runs give the same SHA-256.
- The index is committed with LICENSE and NOTICE; core's licence field
  is `MIT AND CC-BY-SA-4.0`; docs/sources.md updated.
- Progress notes the chunk count, chunk size spread and index size.
- Glossary has: chunking, chunk size, index file, citation fields.
  Roadmap 3.2 ticked.
