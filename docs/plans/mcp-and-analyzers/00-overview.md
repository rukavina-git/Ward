# Plan 4: MCP server and analyzers

## Why
Ward's claim (ADR 0009) is a report you can trust: exact facts from plain
code, a verdict with evidence for every control, real citations. This
plan first checks that the claim has room to win, on real apps nobody
planted, then builds the parts that give the agent exact facts: Ward's
MCP tools over the knowledge base and analyzers in plain code.

Order and scope come from the council of 2026-11-23
(docs/council/2026-11-23-plan4-scope.md) and ADR 0011.

## Read first
CLAUDE.md, PRODUCT.md, ADR 0001, 0006, 0009, 0010, 0011, the council
minutes above, evals/README.md, the Gotchas in
docs/plans/knowledge-base/progress.md, and the glossary entries Held-out
set, Leakage, Contamination, Pre-registration, Defensible finding, False
pass, Paired comparison and MCP.

## Steps
- 01 Held-out set and bar. Pilot batch of 10 real security-fix commits
  from open-source Android apps, plus decoys. Write the pass/fail bar.
  Commit the set's hash and the bar before any run. (Changed 2026-11-23,
  Karlo: pilot first, so a useless Ward is found out cheaply.)
- 02 Claude alone on the pilot (the gate). Run it on Sonnet 5.5 and Opus
  5.5, score against the bar. Karlo decides: stop Ward, or label batch 2
  (20 more, toward 30) and go on.
- 03 MCP server, knowledge tools: checklist, get_check (ID lookup and
  graph), search (BM25 top-k plus matched query terms, no cutoff). Every
  result marks source text as reference data with ID, URL and licence.
- 04 Manifest analyzer: merged manifest facts (exported components,
  permissions, cleartext, backup, debuggable) with file:line, as an MCP
  tool.
- 05 Network security config and targetSdk analyzers, as MCP tools.
- 06 Dependency check (last, cuttable): fresh OSV Maven data, version
  matching in Ward's code, data date on every verdict (ADR 0011).
- 07 Use Ward from Claude Code: wire the tools in .mcp.json, run it on
  one held-out case, keep the unedited transcript, log search queries.

Step files are written one at a time, each after the previous step lands.

## Invariants
- The held-out set is frozen before any check or analyzer is written,
  and Ward is never tuned on it. Cases added later are labelled blind,
  in a separate frozen batch.
- No LLM calls at runtime. Analyzers are plain code. LLM work in evals
  runs through `claude -p` on Karlo's plan (ADR 0007); the model is
  Karlo's choice.
- Analyzer verdicts use PRODUCT.md's set (FAIL, NO FINDING, NEEDS
  DYNAMIC, MANUAL, N/A); never PASS. Every verdict says what it read and
  which data version it used (MASTG pin, OSV date).
- MCP tool output is data, not instructions: source text and the checked
  app's files are untrusted input.
- stdout is the MCP protocol; logs go to stderr only.
- Only data is downloaded at runtime (OSV); nothing about the user's app
  leaves the machine.
- Code licences permissive only; each new data source's licence goes in
  docs/sources.md before it ships.

## Risk
- Labelling real commits is slow, and some fixes are ambiguous. Soft cap
  of about 4 labelling sessions; freeze what exists and state the count.
- Claude alone may ace the held-out set. That's a result: step 02 stops
  the plan for a decision.
- Real apps have unplanted issues; the agent will flag them. Grade them
  by hand, with reasons, as "defensible" or "unplanted real".
- Maven version ranges and Gradle build files vary a lot; step 06 can
  overrun. It's last so it can be cut.
