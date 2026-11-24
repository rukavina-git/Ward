# Plan 6 progress

- [x] 01 depth marking, proxy metrics, strict scoring (HASH)
- [ ] 02 skill v2 and dev runs until the proxy gate passes
- [ ] 03 label held-out batch 2
- [ ] 04 prompt-injection tests in code
- [ ] 05 prompt-injection agent runs
- [ ] 06 skill v2 on the held-out set, plus analyzers-only

## Deviations
- Step 01: plan folder and step file written this run. Depth is set in
  `write_report` (`markDepth` after `applyFills`), not in the skeleton,
  so the skeleton's size doesn't grow. The served log is per server
  process (`packages/mcp/src/served.ts`). Strict found is a proposal
  derived from the lenient label plus a FAIL candidate, with its own
  `strict.label`. `write_report`'s tool description now names the depth
  rule (tool text, not a prompts/ file). Server 0.10.0. The key schema
  keeps `mastg` (it was in the JSON, dropped by the parser).

## Gotchas
Carried over: see docs/plans/the-check/progress.md.

Step 01 (reviewer: no BLOCKER; not fixed):
- SHOULD: `provisional` ignores `strict.label`, so gate.md and
  ward-check.md say "All labels set" while every strict label is a
  proposal. Add `unlabelled(g.strict)` for lenient-found cases, or a
  "strict: proposals" note. Karlo should check the 4 strict proposals.
- NITs: the proxy's transcript fallback counts `get_check` calls that
  returned `found: false` or were cut off; the served log has no order
  or project (a `get_check` after the fills still gives "test text");
  the Depth summary line leaves out the `index` count.

Step 01:
- v1 baseline: test-text share 0% everywhere; strict Ward 2/10 = alone
  2/10. Step 02's dev runs need a transcript (run them via
  `npm run eval:run -- --app planted --setup ward-check`), then
  `npm run eval:proxy`.
- Step 02 pushes test text into the skeleton: it must call
  `markServed` for each check whose text it returns, or depth stays
  "title only". Mind the 20k-token cap: one group per call.
