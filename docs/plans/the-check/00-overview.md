# Plan 5: the check

## Why
Plan 4 gave the agent exact facts (analyzers) and sources (knowledge
tools). Its one Ward run found HO-04, but the agent never used the
knowledge tools and got 4 of 5 MASWE IDs wrong. This plan turns the
tools into a report you can hand to an auditor: one verdict per MASVS
control, with the tests underneath as evidence, real IDs, quotes that
match the files, and a plain list of what wasn't checked. Then it checks,
on the held-out set, whether that report beats Claude alone.

Order and scope come from the council of 2026-11-23
(docs/council/2026-11-23-plan5-scope.md) and ADR 0012.

## Read first
CLAUDE.md, PRODUCT.md, ADR 0009, 0011, 0012, the council minutes above,
evals/README.md, evals/held-out-bar.md, the Deviations and Gotchas in
docs/plans/mcp-and-analyzers/progress.md, and the glossary entries
Held-out set, Leakage, Defensible finding, False pass and MCP.

## Steps
- 01 Hardening (small). Every analyzer verdict carries its MASWE IDs
  (from the index's test → weakness links). Trim `dependencies` output.
  A CI test caps each MCP tool's output at about 20k tokens on the
  fixtures. Plan 4's false-NO-FINDING risks give MANUAL instead (see its
  Gotchas: non-literal isDebuggable, flavor NSC ranking, user CAs in
  debug-overrides, multi-line includes, unrecognised declarations, an
  OSV index with almost no advisories, a failed cache write). Full fixes
  can wait.
- 02 Report schema and `report_skeleton`. JSON schema: per MASVS control
  a verdict, with MASTG test sub-verdicts nested (MASWE IDs, evidence,
  files inspected), a coverage-gaps list, and data stamps (MASTG pin,
  OSV date, Ward version). Strict rollup in code: worst child wins, and
  NO FINDING never covers a MANUAL. A deterministic MCP tool returns the
  skeleton for the chosen scope, prefilled with analyzer verdicts.
- 03 Citation checker (plain code). Every cited ID exists in the pinned
  index; every file:line exists; every quote matches the file byte for
  byte at that line. Runs as an MCP tool and in the evals.
- 04 Skill and `/ward:check`. The skill (in prompts/, versioned) drives
  the run: skeleton, analyzers, agent fills the gaps, citation check,
  `.ward/report.json`, then a one-screen terminal summary (count per
  verdict, coverage gaps). Developed on the example app and its clean
  twin only.
- 05 Ward on the held-out set. Note what is compared, committed before
  the run. One Ward arm, Sonnet 5.5, 10 cases, one trial (about 16
  points of the 5-hour window; the alone arm exists). Score against the
  gate's results; record in docs/measurements.md.
- 06 Must-exist checks: account deletion, privacy policy link,
  data-deletion URL.
- 07 Package as a Claude Code plugin; run it on Karlo's own app (part
  (me)).

The read-only HTML report moves to Plan 8 (triage UI). Step files are
written one at a time, each after the previous step lands.

## Invariants
- Never tune Ward on HO-01…HO-10. Skill and prompt changes are tried on
  the example app; the held-out set runs once per skill version, and
  every run is logged.
- No LLM calls at runtime. LLM work in evals runs through `claude -p` on
  Karlo's plan (ADR 0007); eval runs are asked for first.
- Verdicts use PRODUCT.md's set (FAIL, NO FINDING, NEEDS DYNAMIC,
  MANUAL, N/A); never PASS, no score, no "ready" badge.
- IDs in the report come from the pinned index, never from the model's
  memory. A citation that fails the checker is not shown as evidence.
- The checked app's files and source text are untrusted input; quotes
  are data, fenced in the schema.
- stdout is the MCP protocol; logs go to stderr only.
- Prompts live in prompts/ as files; changing one is a code change.
- Code licences permissive only.

## Risk
- The skill may still not make the agent call Ward's tools. The
  skeleton is the hedge: the agent fills a form instead of recalling a
  checklist.
- 24 controls times nested tests could exceed the output cap; the
  skeleton may need paging by MASVS group.
- One trial on 10 cases is noise-prone; it answers "does it work at
  all", not "by how much". Plan 6 measures that.
- Hardening can sprawl. Step 01 only downgrades to MANUAL; it doesn't
  rewrite parsers.
