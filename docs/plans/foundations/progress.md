# Plan 1 progress

- [x] 01 stack ADRs (b0892ab)
- [x] 02 scaffold (29c2d26, CI green:
  https://github.com/rukavina-git/Ward/actions/runs/44871708314)
- [ ] 03 hello MCP

## Deviations
- Plan rewritten after the product council of 2026-11-21 (ADR 0001):
  no web chat, no hosted backend. Deploy moved to plan 9.
- Step 01: ADR 0002 also weighs a TS + Kotlin-analyzer hybrid; ADR 0004
  adds the Voyage 4 option (to be measured in plan 3); ADR 0006 switched
  from bundling the server to `npx` with a pinned version. Owner chose
  Haiku 5.5 for offline LLM work (ADR 0005).
- After step 01: owner dropped the API key (ADR 0007, supersedes 0005).
  Step 03 (API key) removed; step 04 (LLM spike) replaced by 03 hello
  MCP.
- Step 02: TypeScript 6.0.3, not 7.0.2, because typescript-eslint 8.73
  supports TS <6.1. ADR 0008 is committed as Proposed; owner to accept.
  `engines` is a minimum (`>=26`), and `.nvmrc` holds the pin.
  Adding `npm run format:check` to the settings allow-list was blocked
  by the permission classifier, so it was dropped.

## Gotchas
For step 03 (hello MCP):
- MCP TypeScript SDK v2 is stable: `@modelcontextprotocol/server` 2.4.0
  (Apache-2.0, npm `latest`). v1 is `@modelcontextprotocol/sdk` 1.32.2
  (MIT). Read the v2 docs for the stdio server API before writing code.
- TS 6 defaults `types` to `[]`. A package that uses Node APIs needs
  `@types/node` and `"types": ["node"]`. Relative imports need `.js`.
- A new package needs `typecheck` and `build` scripts and a tsconfig
  extending `tsconfig.base.json` (copy packages/core).
- The shell's nvm default is Node 24. Run `nvm use` before npm.
- The edit hook lints only the edited file. Lint errors it causes in
  other files show up only in `npm run lint` or CI.
- Owner decision pending: 12 MPL-2.0 dev-only packages (lightningcss,
  via vitest → vite). They're never shipped. Accept them in ADR 0008, or
  switch to `node:test`.
- npm 11 skips fsevents' install script (macOS-only, optional, harmless).
- `claude plugin validate .` warns that the README has no install line.
  That's for plan 5.
