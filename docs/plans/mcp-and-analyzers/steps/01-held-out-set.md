# 01 Held-out set and bar

## Goal
A frozen test of real Android security fixes that nobody planted and
Ward has never seen, plus the pass/fail bar written before any run.
Step 02 runs Claude Code alone on it; that result decides whether Ward's
analyzers are worth building (ADR 0009).

## Do
1. Find candidates. Real security-fix commits in open-source Android
   apps (Kotlin or Java, Gradle builds). Sources, in order: CVEs and
   GitHub security advisories that link a fix commit in an Android app
   repo; F-Droid apps' commit history (commit messages naming a security
   fix); public disclosure write-ups that link the fix. Use `gh` and the
   web; record where each candidate came from.
2. Keep a candidate only if all hold:
   - The fix commit is small and about one issue (or a few clearly
     separable ones); the parent commit is the flawed version.
   - The issue is static: visible in source, manifest, Gradle or config
     files without running the app.
   - It maps to a MASVS v2.1 control and a MASWE ID (MASTG test where
     one exists), using the IDs from Ward's pinned index.
   - The repo is public and builds with Gradle (we don't build it, but
     the analyzers will need its files laid out normally).
   Prefer commits after the tested models' published training cutoff
   (check current docs) and harder kinds: absences (a check that should
   exist), dependency CVEs, config and build issues. Aim for a mix: no
   more than about a third of one kind.
3. Pilot first: label **10 issues** (batch 1, 1–2 sessions), from as
   many repos as possible (at most 3 cases per repo), and freeze them.
   Step 02 runs on this batch. If Claude alone aces it, Karlo decides
   whether to stop Ward. If not, batch 2 adds 20 more toward 30, still
   before any Ward check exists, frozen as its own batch. Soft cap for
   both batches: about 4 labelling sessions.
4. Decoys toward 30: for each case, note code in the parent commit that
   looks risky but is fine (a decoy), and whether the fix commit itself
   is a clean version (the "clean twin" of that case). Unsure cases are
   labelled `defensible`, never forced into issue or decoy.
5. Answer key `evals/answer-keys/held-out.json`, same style as
   `example-app.json`. Header: `name`, `keyVersion`, `created`, `frozen`
   (date), `sources` (MASVS, MASWE, MASTG pins), `notes` (who labelled,
   how candidates were found, the model cutoffs checked). Each case: `id`
   (`HO-01`…), `repo` (URL), `parent` and `fix` (full commit hashes),
   `found` (where the candidate came from, with link), `title`, `kind`
   (`code`, `config`, `absence`, `dependency`), `severity`, `masvs`,
   `maswe`, `mastg`, `verdict`, `anchors` (file and line range in the
   parent commit), `fixSummary` (one line, our words), `decoys` (file,
   lines, why fine), `defensible` (if any), `afterCutoff` (true/false per
   model). No code copied from the repos: only URLs, hashes, paths,
   lines and our own words.
6. Bar `evals/held-out-bar.md`, written before step 02. It states, per
   metric (issues found, false passes on the fix commit, false alarms on
   decoys, explicit verdicts per control, wrong citations), what result
   from Claude alone means "Ward has room" and what means "rethink". With
   about 30 cases a rate is roughly ±18 points; the bar says which gaps
   are big enough to count.
7. Freeze. A script `npm run heldout:check` (local, needs network)
   verifies every repo and commit exists and every anchor path exists in
   the parent commit (via `git` with an argument list, no shell; clones
   go to a gitignored cache and nothing from them is run). Then commit
   the answer key, the bar and the answer key's sha256 (in the bar file)
   in one commit, before any step 02 run.
8. Tests (Vitest, offline): schema valid, unique IDs, every MASVS, MASWE
   and MASTG ID exists in the committed index and isn't a placeholder,
   at most 3 cases per repo, hashes are 40 hex chars, the hash in the
   bar file matches the answer key.

## Not in scope
- Running Claude Code on the set (step 02).
- Changing the runner for repo checkouts (step 02).
- Any Ward check, analyzer or MCP tool (steps 03 onward).
- Building the apps.

## Done when
- `npm run lint`, `npm run format:check`, `npm run typecheck` and
  `npm test` pass, and CI is green.
- `npm run heldout:check` passes locally.
- Case counts per kind, repo and `afterCutoff` are in progress.md, with
  sessions spent.
- Karlo has reviewed the bar and spot-checked at least 5 cases.
- Glossary has: training cutoff, freezing (an eval set), fix commit /
  parent commit. Roadmap "Held-out eval set" ticked once step 02 has
  run too.
