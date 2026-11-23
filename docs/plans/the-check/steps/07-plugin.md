# 07 Package as a plugin, run it on my own app

## Goal
Anyone can install Ward from this repo with two commands and run
`/ward:check` on their own Android project, with no clone, no
`npm install` and no build. Then Karlo runs it on his own app.

## Why a bundle
A plugin installed from a marketplace is a copy of `plugin/` only: no
`node_modules`, no `packages/*/dist`. So the MCP server ships as one
JavaScript file (esbuild bundle of `packages/mcp`, with the MCP SDK and
zod inside) plus the pinned index. Rejected: an npm package started with
`npx` (publishing to npm is an outward step, and the first run would
download from the network); installing deps on first start (slow, needs
npm on the user's machine).

## Do
1. `scripts/build-plugin.mjs` (`npm run plugin:build`): esbuild
   `packages/mcp/src/index.ts` → `plugin/server/index.mjs` (ESM, node
   target). Copies `packages/core/data/index.json`, `LICENSE`, `NOTICE`
   to `plugin/data/` (the bundle finds it at `../data/index.json`, as
   dist does). Writes `plugin/server/THIRD_PARTY.md` from esbuild's
   metafile: every bundled package, version, licence; fails on a
   non-permissive licence. Runs `prompts:sync`.
2. `plugin/.mcp.json`: server `ward`, `node
   ${CLAUDE_PLUGIN_ROOT}/server/index.mjs`. `plugin.json` and the
   marketplace entry: version 0.9.0, real description. `plugin/LICENSE`.
3. Test: spawn `plugin/server/index.mjs` over stdio; same tool list and
   version as dist; one `checklist` call works (index found).
4. CI: after the build, `npm run plugin:build` and
   `git diff --exit-code plugin/` (the committed bundle is current).
5. README section "Install": `/plugin marketplace add`, `/plugin
   install`, `/ward:check`.

## (me) Run it on my own app
After the commit is pushed:
1. In Claude Code, anywhere: `/plugin marketplace add rukavina-git/Ward`
   (or the local path), then `/plugin install ward@ward`. Restart.
2. Open your app's repo, run `/ward:check`.
3. Read `.ward/report.json` and the summary. Note false alarms and
   misses; tell Claude in the next session. Don't commit your app's
   report to this repo.

## Not in scope
Publishing to npm or an official marketplace, skill changes, the HTML
report (Plan 8).

## Eval
No prompt, retrieval or model change: no eval run.

## Cost
None.

## Done when
- `npm run lint`, `format:check`, `typecheck`, `test` pass.
- `npm run plugin:build` twice gives no diff.
- `claude plugin validate plugin` (if available) passes.
