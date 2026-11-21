# Plan 1 progress

- [x] 01 stack ADRs (b0892ab)
- [x] 02 scaffold (29c2d26, CI green:
  https://github.com/rukavina-git/Ward/actions/runs/44871708314)
- [x] 03 hello MCP

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
  supports TS <6.1. ADR 0008 was accepted after the step, including the
  MPL-2.0 dev-only exception.
  `engines` is a minimum (`>=26`), and `.nvmrc` holds the pin.
  Adding `npm run format:check` to the settings allow-list was blocked
  by the permission classifier, so it was dropped.
- Step 03: SDK v2 serves stdio with `serveStdio(factory)`, not
  `StdioServerTransport` + `connect`. CI now builds right after `npm ci`
  (packages import each other's dist types; the stdio test spawns dist),
  and root `pretest` builds so tests never run a stale dist. ESLint
  `no-console` (error/warn allowed) guards stdout in packages/mcp.
  CLAUDE.md Repo/Commands/Tooling updated. The exchange was captured with
  three headless `claude -p` runs (clear description, vague description,
  vague name + description), plus Karlo's interactive session. `bin`
  field added to packages/mcp ahead of plan 5. Approving the server
  writes `.claude/settings.local.json`, which broke local
  `format:check`; added to `.prettierignore`.

## Gotchas
For plan 2 and later:
- Fresh clone: run `npm run build` before typecheck, the edit hook or
  the `ward` MCP server. Workspaces build alphabetically (core before
  mcp); a new package that imports another must sort after it, or switch
  to TS project references (`tsc -b`).
- `.mcp.json` runs `node` from PATH (nvm default Node 24) on
  packages/mcp/dist. A project server shows "Pending approval" in
  `claude mcp list` until approved in an interactive session.
- Headless `claude -p` in this repo can run Bash on its own (one run ran
  `npm test`, which rebuilt dist mid-experiment). For experiments and
  baselines, restrict tools with `--tools` and `--allowedTools`, and use
  `--strict-mcp-config --mcp-config` to load only the servers you mean.
- Claude Code defers MCP tools: the model first sees only the
  `mcp__<server>__<tool>` name, then loads the schema via ToolSearch.
- `total_cost_usd` in `claude -p` JSON is an API-price estimate; on the
  plan nothing is billed. The 3 runs in step 03 showed ~$0.06 to $0.21.
- Open reviewer items for plan 4: no test that stdout carries only
  JSON-RPC (collect `client.onerror`); no-console doesn't cover
  @ward/core or `process.stdout.write`; stdio test hides server stderr;
  decide whether tool descriptions live in prompts/ and need evals.
- TS 6 defaults `types` to `[]`: Node packages need `@types/node` and
  `"types": ["node"]`. Relative imports need `.js`.
- The shell's nvm default is Node 24. Run `nvm use` before npm.
- MPL-2.0 is allowed only for dev-only packages (ADR 0008).
- npm 11 skips fsevents' install script (macOS-only, optional, harmless).
- `claude plugin validate .` warns that the README has no install line.
  That's for plan 5.
