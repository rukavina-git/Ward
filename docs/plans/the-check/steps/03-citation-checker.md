# 03 Citation checker

## Goal
Nothing in a Ward report is shown as evidence unless plain code has
confirmed it: every ID is in the pinned index and sits where the index
puts it, every file:line exists in the checked app, and every quote is
really there. The model fills the form; code checks the form.

## Do
1. `packages/report/src/citations.ts`: `checkReport(report, root, kb)`.
   - Schema: `reportSchema.parse`; a bad shape is one issue, nothing else
     is checked.
   - IDs: each control is a MASVS control in the index; each check is a
     test or weakness of that control (per `kb.checklist`), with the
     index title; each `maswe` ID is a weakness of that control. Every
     MASVS/MASWE/MASTG ID written in a `reason` or `detail` exists.
     `stamps.mastg` matches the index pin.
   - Files: evidence `file` and every `filesInspected` (checks and
     analyzer runs) is relative, resolves (symlinks too) inside the
     root, and is a regular file under 1 MB.
   - Lines and quotes: `line` is within the file; a `quote` is non-blank
     and found byte for byte in the text starting at that line (a quote
     with newlines spans the following lines; a CR before LF is ignored).
   - Rollup: control verdicts, counts and gaps equal `finalize`'s.
   - An agent FAIL with no evidence that passed is an issue.
   Returns counts of what was checked and a capped issue list, each
   issue with its place (control, check, evidence index).
2. `dropBadEvidence(report, result)`: the report without failed
   evidence, finalized. Step 04 writes this one.
3. MCP tool `check_report` (projectRoot, reportPath default
   `.ward/report.json`, inside the root): reads the file (2 MB cap),
   runs the checker, returns `ok`, counts and issues. Read-only. Server
   0.7.0.

## Not in scope
Writing the report and the skill (step 04). Comparing agent verdicts
with a re-run of the analyzers ("never lower a prefill"). Wiring the
checker into the held-out scoring (step 05 uses the exported function).

## Eval
No retrieval, chunking, prompt or model change: no eval run.

## Cost
None. No LLM calls.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- Tests: each issue kind on synthetic reports; path escapes (`..`,
  absolute, symlink out); CRLF and multi-line quotes; the skeleton from
  both fixtures passes clean (analyzer evidence lines are real); the tool
  on a written report, a missing file and a path outside the root.
