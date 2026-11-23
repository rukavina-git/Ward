# 12. Report shape: controls with nested tests, built from a skeleton

Date: 2026-11-23
Status: Accepted

## Context
Plan 4's Ward run found HO-04 but the agent ignored the knowledge tools
and got 4 of 5 MASWE IDs wrong; Claude alone got 25 of 83 citations
wrong on the gate. ADR 0009 promises a verdict with evidence for every
control in scope. A council (docs/council/2026-11-23-plan5-scope.md)
chose the report's unit and how it gets built.

## Options
- **One verdict per MASVS control (24).** Small, easy to read. Con:
  hides which test failed.
- **One verdict per MASTG test (100+).** Precise. Con: mostly NEEDS
  DYNAMIC, risks the 25k-token tool output cap, buries the reader.
- **Per control, tests nested** (chosen). The 24-row summary on top,
  each row traceable to its tests and MASWE IDs.
- **The agent writes the report freely from the skill.** Simplest. Con:
  IDs come from memory, and controls go missing silently.

## Decision
- The report has one verdict per MASVS control in scope, with MASTG
  test sub-verdicts nested under it, each with MASWE IDs, evidence and
  files inspected; plus a coverage-gaps list and data stamps (MASTG pin,
  OSV date, Ward version).
- Rollup is strict, in code: the worst child wins, and NO FINDING never
  covers a MANUAL or NEEDS DYNAMIC.
- A deterministic MCP tool, `report_skeleton`, returns every control and
  test in scope, prefilled with analyzer verdicts and IDs from the
  pinned index. The agent fills the gaps.
- A plain-code citation checker rejects IDs not in the index, missing
  file:line, and quotes that don't match the file byte for byte.
- The HTML report moves to Plan 8; Plan 5 shows a terminal summary.

## Consequences
- Easier: IDs are copied, not recalled; missing controls are visible;
  a quote steered by prompt injection fails the check.
- Harder: a schema and rollup to maintain, and the skeleton may need
  paging to stay under the output cap.
- Revisit if the held-out run shows the agent ignores the skeleton too.
