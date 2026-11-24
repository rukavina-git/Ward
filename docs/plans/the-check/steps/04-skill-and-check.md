# 04 Skill and `/ward:check`

## Goal
One command runs the whole check: `/ward:check` gets the skeleton, the
agent reads the code for the checks still open, and Ward's code turns
the agent's answers into `.ward/report.json` plus a one-screen summary.
The agent never writes IDs, titles or control verdicts: it only answers
the open checks.

## Do
1. `packages/report/src/fills.ts`:
   - `fillsSchema`: `{ fills: [{ check, control?, verdict, reason,
     evidence, filesInspected }] }`. Verdicts from PRODUCT.md's set.
   - `applyFills(report, fills)`: a fill sets every pending row with
     that check ID (or only the one under `control`), `by: agent`. On a
     row prefilled by `owasp` only FAIL is taken (raise, never lower).
     Analyzer rows, unknown IDs and duplicates are rejected with a
     reason. Returns the finalized report and the rejections.
   - `summaryText(report, issues, rejected)`: fixed-format plain text,
     at most ~40 lines: counts per control verdict, each FAIL control
     with its failing checks and first evidence file:line, gap counts,
     citation issues and rejected fills (counts, first few).
2. MCP tool `write_report` (projectRoot, variant, group, profile,
   fillsPath default `.ward/fills.json`): rebuilds the skeleton (same
   code as `report_skeleton`, so prefills can't be lowered or edited),
   applies the fills, runs `checkReport`, `dropBadEvidence`, writes
   `.ward/report.json` (and `.ward/.gitignore` with `*`), returns the
   summary, counts, gaps, issues (capped) and rejections. Paths stay
   inside the root. Server 0.8.0.
3. The skill, versioned in `prompts/ward-check/SKILL.md` (v1); a byte
   copy at `plugin/skills/check/SKILL.md` so the plugin's `/ward:check`
   loads it (`npm run prompts:sync`; a test fails when they differ and
   when the skill names a tool the server doesn't have).
4. Try it once on the example app and once on its clean twin (`claude
   -p`, Sonnet 5.5, Karlo's plan; asked first). Record the numbers in
   docs/measurements.md.

## Not in scope
The held-out run (step 05), packaging the MCP server into the plugin
(step 07), HTML (Plan 8), re-running analyzers on agent claims.

## Eval
A new prompt (the skill). No eval run on the held-out set here: it runs
once per skill version in step 05. The dev runs use the fixtures only.

## Cost
Two `claude -p` runs on the fixtures, Sonnet 5.5: about 2–4 points of
the 5-hour window. No paid API.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: applyFills (pending, owasp raise, owasp lower rejected,
  analyzer rejected, unknown ID, control-scoped, PASS rejected);
  summary line cap; the tool on the example app with a fills file
  (writes, drops a bad quote, keeps prefills), a missing fills file,
  a fills path outside the root; skill copy and tool names.
- Dev runs on both fixtures done and recorded (or deferred by Karlo).
