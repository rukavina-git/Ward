# 06 Dependency check (OSV)

## Goal
Find declared Maven dependencies with known vulnerabilities, as ADR 0011
decided: download OSV's Maven data at check time, cache it with its
date, match versions in Ward's own code. New MCP tool `dependencies`.

## Do
1. `packages/analyzers/src/osv.ts`: download
   `https://osv-vulnerabilities.storage.googleapis.com/Maven/all.zip`
   (about 10 MB, 7,000 advisories, deflate only), unzip with node:zlib
   (no new dependency; anything but plain deflate is an error), keep
   only Maven `affected` entries of advisories not withdrawn, and cache
   a compact index in the user cache folder (`WARD_CACHE_DIR`, else
   `$XDG_CACHE_HOME/ward`, else `~/.cache/ward`) with the download time
   and the server's Last-Modified. Refresh when older than 24 h. No
   network: use the cache and say its age. No cache: MANUAL, never NO
   FINDING. Size and time caps on the download. Nothing about the app
   is sent (fixed URL, no query).
2. `packages/analyzers/src/maven-version.ts`: Maven's version order
   (ComparableVersion rules: numbers, qualifiers alpha < beta <
   milestone < rc < snapshot < release < sp) and OSV range matching
   (`introduced`, `fixed`, `last_affected`, plus the explicit
   `versions` list).
3. `packages/analyzers/src/dependencies.ts`: per module, the
   `dependencies { }` block of `build.gradle(.kts)`: string notation
   `"g:a:v"`, `libs.x.y` catalog aliases and `libs.bundles.x`, with
   `gradle/libs.versions.toml` (`version.ref`, `version`, `module`,
   `group`/`name`). With file:line of the version. Unresolved (no
   version, BOM-managed, `$var`, rich versions) are listed, never
   guessed. Test, androidTest and debug configurations and annotation
   processors are listed but don't FAIL a release check.
4. Verdict `known-vulnerable-dependency` (MASTG-TEST-0272,
   MASWE-0044): FAIL per matched dependency with the advisory IDs,
   aliases (CVE), fixed version and link; NO FINDING only if every
   release dependency resolved; else MANUAL naming the unresolved.
   Every verdict carries the data date. Limits: direct dependencies
   only, no Gradle resolution (transitive, BOMs, constraints).
5. MCP tool `dependencies` (same input and notice; not read-only to
   the outside world: it downloads data). Tests offline: a small
   hand-built zip, injected fetch, temp cache dir. EA-19 (Gson 2.8.5)
   FAIL at `gradle/libs.versions.toml:11`; clean twin (2.15.0) none.
   Never HO-01…HO-10.

## Not in scope
Transitive dependencies, running Gradle, SBOMs, other ecosystems,
plugin versions (AGP, Kotlin).

## Eval
No retrieval, chunking, prompt or model change: no eval run.

## Cost
None. No LLM calls. One ~10 MB public download per day of use.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass; CI green.
- EA-19 FAIL with file:line on the example app (fixture data); clean
  twin none. One live run against the real OSV data, by hand.
- OSV sources (GHSA CC BY 4.0, MAL Apache 2.0) in docs/sources.md.
- Glossary has: OSV, CVE, version range, transitive dependency.
