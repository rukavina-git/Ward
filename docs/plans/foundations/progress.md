# Plan 1 progress

- [x] 01 stack ADRs (b0892ab)
- [ ] 02 scaffold
- [ ] 03 (me) API key
- [ ] 04 LLM spike

## Deviations
- Plan rewritten after the product council of 2026-11-21 (ADR 0001):
  no web chat, no hosted backend. Deploy moved to plan 9.
- Step 01: ADR 0002 also weighs a TS + Kotlin-analyzer hybrid; ADR 0004
  adds the Voyage 4 option (to be measured in plan 3); ADR 0006 switched
  from bundling the server to `npx` with a pinned version. Owner chose
  Haiku 5.5 for offline LLM work (ADR 0005).

## Gotchas
For step 02 (scaffold):
- Confirm Node 26 is Active LTS on nodejs.org before pinning it.
- MCP TypeScript SDK: check whether v2 (2026-07-28 spec, ESM only) is
  stable or still beta; pick v1 or v2 on that basis.
- Follow ADR 0002's layout, including `plugin/` and the repo-root
  `.claude-plugin/marketplace.json`.
- Data packages are `MIT AND CC-BY-SA-4.0` with a NOTICE (ADR 0003).
- Check each dependency's licence when adding it (Transformers.js
  expected Apache 2.0).
