# 04 Prompt-injection tests in code

## Goal
Show in plain-code tests that hostile text can't change what Ward's code
decides or shows: IDs, verdicts, the rollup, depth, or the terminal
summary. Two sources of hostile text: the checked app's files (read by
the analyzers, and by the agent) and the agent's own fills (an agent the
app has manipulated can write anything into `fills.json`).

## Do
1. Summary: every string that comes from the app or the agent (evidence
   file names, check IDs in rejected answers, citation messages) is made
   safe for display: control characters, ANSI escapes and line breaks
   become visible placeholders, backtick runs can't close a code block,
   and long values are clipped. Found 2026-11-26: a file name with a
   newline could forge "Citation check: … confirmed" and end the
   summary's code block.
2. Tests, hostile fills: unknown or malformed IDs, PASS, extra fields
   (`by`, `depth`, `hardening`, control verdicts) are rejected or
   ignored; prefilled analyzer and index verdicts stay; rollup, counts,
   gaps and depth come from code; reasons that name IDs not in the index
   are flagged by the citation checker; evidence outside the project or
   with a quote that isn't in the file is dropped.
3. Tests, hostile app text: comments and strings that tell Ward or the
   agent a check passes don't change any analyzer verdict (manifest,
   network config, build config); hostile names reach the report only
   as data.
4. Tests, hostile report: `check_report` flags a report whose verdicts,
   counts, gaps or hardening flags were edited by hand.

## Not in scope
- Agent runs with a canary (step 05).
- The HTML report's escaping (plan 8).

## Done when
- lint, format, typecheck, tests pass; server version bumped,
  `plugin:build` committed.
- Each guarantee above has a test that fails if the guard is removed.
