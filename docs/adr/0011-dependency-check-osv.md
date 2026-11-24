# 11. Dependency check: fresh OSV data, matched by Ward

Date: 2026-11-23
Status: Accepted

## Context
The baseline (ADR 0009) missed a vulnerable Gson version: the agent
can't know every published vulnerability. OSV (osv.dev, run by Google)
is a free database of known vulnerabilities in open-source packages,
including Maven, which covers Android libraries. ADR 0009 planned an
"offline OSV snapshot kept current". A council
(docs/council/2026-11-23-plan4-scope.md) split 3–3 on shipping it in
plan 4: it targets a real miss, but an old copy of the data gives a
false "no known vulnerabilities", the worst failure for an audit.

## Options
- **Snapshot shipped with Ward.** Works offline. Con: stale from the day
  it ships; needs a release to refresh.
- **Wrap OSV-Scanner** (Google's CLI, Apache 2.0). Pro: maintained by
  others. Con: the user installs a second tool, and Ward's part shrinks
  to formatting someone else's output.
- **Query the osv.dev API per package.** Always fresh. Con: sends the
  app's dependency list to a third party on every check.
- **Download the OSV data at check time, match in Ward** (chosen). Pro:
  fresh, nothing to install, the dependency list never leaves the
  machine, and the matching is ours. Con: more work (Gradle parsing,
  Maven version ranges) and a network fetch at runtime.

## Decision
- At check time, Ward downloads OSV's published Maven data, caches it
  locally with its download date, and compares the app's declared
  dependencies (build files and version catalogs; direct dependencies
  only at first) against the vulnerable version ranges, in Ward's own
  code.
- Only data is downloaded; nothing about the app is uploaded.
- Every dependency verdict carries the data date. With no network, Ward
  uses the cached copy and says how old it is; with no copy at all, the
  verdict is MANUAL, never NO FINDING.
- It is the last analyzer in plan 4 and may be cut if licence or size
  checks fail. The exact download format and the licence of each OSV
  source are verified in that step and recorded in docs/sources.md.

## Consequences
- Easier: no extra install; a stale result is visible, not silent.
- Harder: Ward now makes one network request at runtime (data only).
  PRODUCT.md's "no code leaves the machine" still holds. Maven version
  comparison has edge cases and needs its own tests.
- Revisit if the download is too large or slow for a check, or if a
  source's licence doesn't allow redistribution of matched advisories.
