# 01 Sources and ingest

## Goal
Turn the three OWASP sources into clean records, one per ID, linked into
a graph: control → weakness (MASWE) → test → demo. Every record keeps
where it came from (URL at the pinned tag, version, commit, licence), so
citations can later be built from fields, never generated. No chunks,
no index and no search yet (step 02 onward). This step makes sure the
data underneath them is complete and linked correctly.

## Do
1. Pinned sources. One table in code (name, repo, tag, commit, licence),
   checked against GitHub on 2026-11-22:
   - MASVS v2.1.0, commit 8e133d0 (`controls/`)
   - MASWE v1.0.0, commit 308b82b (`weaknesses/`)
   - MASTG v2.0.0, commit 990472d (`tests-beta/android`,
     `tests/android`, `demos/android`)
   All three are CC BY-SA 4.0 and these are the latest releases.
2. Package `packages/ingest` (`@ward/ingest`), built like the others,
   imports core. `npm run ingest` downloads, parses, links, checks and
   writes `packages/ingest/out/records.json`. Downloads go to
   `packages/ingest/.cache/`. Both are gitignored: step 02 decides what
   ships.
3. Download: `git clone --depth 1 --branch <tag>` via spawn with an
   argument list (no shell), then fail unless `HEAD` equals the pinned
   commit. Downloaded files are untrusted data: never run anything from
   them (no `run.sh`, no npm, no scripts), skip symlinks when walking
   (a link could point at a file on Karlo's disk), and clone with
   `core.symlinks=false`. Rejected: the GitHub API per file (thousands
   of calls, rate limits) and release tarballs (no commit check without
   an extra call, and archive extraction to get right).
4. Record type in `packages/core` (step 02's lookup reads it). Per
   record: `id`, `kind` (`control`, `weakness`, `test`, `demo`),
   `title`, `status` (`active`, `placeholder`, `deprecated`), `body`
   (markdown with front matter removed), `fields` (other front matter
   kept as data: profiles, type, apis, cwe…), `links`, and `source`
   (name, version, commit, path, URL at the tag, licence). Demos also
   keep their code files as text (`.kt`, `.java`, `.xml`, `.sh`, output
   files), never executed.
5. Parsers, Android only (Ward is Android; iOS-only records skipped):
   - Controls: 24 files with no front matter; ID from the `#` heading,
     statement from `## Control`.
   - Weaknesses: YAML front matter. `mappings.masvs-v2` gives the
     controls, `mappings.maswe-beta` the old IDs. Skip `platform: [ios]`.
   - Tests (v2, `tests-beta/android`): `weakness`, `knowledge`,
     `best-practices` and `type` (static, dynamic…) from front matter.
     Placeholders kept with their status.
   - Old tests (v1, `tests/android`): all 51 are deprecated. Keep each
     as a small record with `coveredBy`, so an old ID an agent cites can
     be redirected to the new tests.
   - Demos: `test` from front matter, plus the code files.
   A YAML parser is the only new dependency (`yaml`, ISC, or `js-yaml`,
   MIT; licence checked before install). Markdown bodies stay text;
   splitting them is step 02's job.
6. Graph and the MASWE renumbering. MASTG v2.0.0 tests name beta MASWE
   IDs; the same number can mean a different weakness in v1.0.0. So a
   test's `weakness` is always translated through `maswe-beta`, never
   taken as is. Checked today:
   - Most beta IDs translate to exactly one weakness.
   - MASWE-0012 and MASWE-0108 (named by tests) map to 3 and 2 v1
     weaknesses: ambiguous.
   - MASWE-0097 maps to none: unresolved.
   - MASTG-TEST-0334 translates cleanly but to the wrong weakness
     (answer key note: JavaScript bridges are MASWE-0033).
   Hand fixes go in one overrides file, each with a reason. Claude
   proposes them from the test and weakness texts; Karlo approves.
   Links are stored both ways (a control knows its weaknesses, a
   weakness its tests, a test its demos).
7. Checks at the end of every ingest (fail with a non-zero exit):
   counts per kind, no dangling link, every v2 test links to at least
   one weakness (or has an override saying why not), every weakness to
   at least one control, every demo to an existing test. Known
   mappings: the 18 issues in `evals/answer-keys/example-app.json` that
   name a MASTG test must have that test → weakness → control path in
   the graph.
8. Reproducible: records sorted by ID, fixed key order, LF, no dates or
   absolute paths in the output. Two runs give the same SHA-256.
9. Tests (Vitest) on a few real files copied verbatim into
   `packages/ingest/test/fixtures/` with a README giving source, commit
   and CC BY-SA 4.0: one parser test per kind, beta translation (one,
   several, none, override), symlink skipped, commit mismatch fails,
   same input gives the same bytes, URL built at the tag.
10. docs/sources.md: MASVS, MASWE and MASTG rows get their commit and
    "ingested into the knowledge base (plan 3)". Fix the step 04 note:
    OWASP's plugin data is CC BY-SA 4.0, not CC BY 4.0.

## Not in scope
- Chunks, the index file, LICENSE and NOTICE for the data, ID lookup
  in core (step 02).
- Knowledge (MASTG-KNOW), best practices (MASTG-BEST), techniques and
  tools as records. Tests keep their IDs as plain references; add the
  records later if the retrieval eval shows they're needed.
- MASVS group pages (`Document/05-MASVS-STORAGE.md`…) and iOS.
- A CI job that runs ingest (needs a 60 MB download). Step 02 decides,
  once there's an index to compare.
- Fixing OWASP's data upstream (worth an issue on MASTG for 0334 later).

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- `npm run ingest` passes its checks with, for the pinned versions:
  24 controls, 77 weaknesses, 112 v2 tests (14 placeholders), 51 v1
  tests (deprecated), 94 demos (5 placeholders).
- All 18 known mappings hold; every override has a reason and Karlo's
  approval.
- Two ingest runs give byte-identical `records.json`.
- docs/sources.md updated. Glossary has: ingestion, front matter,
  record, knowledge graph, pinning. Roadmap 3.1 ticked.
