# 02 Scaffold

## Goal
A TypeScript workspace where lint, typecheck, tests and build run with one
command each, locally and in CI. No product code yet: one placeholder
package proves the pipeline works. Layout follows ADR 0002.

## Do
1. Tooling ADR (0008), short, same style as 0002–0007. ADR 0002 left
   these open. Starting points, each compared with one alternative:
   - Package manager: npm workspaces (ships with Node, `.claude/settings.json`
     already allows `npm run`). Compare pnpm.
   - Lint: ESLint (flat config) + typescript-eslint with type-aware rules
     (floating promises, unsafe `any`). Compare Biome.
   - Format: Prettier. Compare formatting through the linter.
   - Tests: Vitest. Compare `node:test` with Node's built-in type stripping.
   - TypeScript: ESM only, `NodeNext`, `strict` plus
     `noUncheckedIndexedAccess`. One base tsconfig, one per package.
   Check licences (MIT, Apache 2.0, BSD only) and current versions from
   live docs.
2. Node: confirm Node 26 is Active LTS on nodejs.org. Pin it in `.nvmrc`
   and `engines`.
3. Workspace: root `package.json` (private) with scripts `lint`,
   `typecheck`, `test`, `build`, `format:check`. One package,
   `packages/core`, with a placeholder export and one test. Other
   packages appear when their plan starts.
4. Plugin skeleton per ADR 0002/0006: `.claude-plugin/marketplace.json`
   pointing to `./plugin`, and `plugin/.claude-plugin/plugin.json`. No
   skill, no MCP server yet. Validate with Claude Code's plugin validator
   if one exists.
5. CI: `.github/workflows/ci.yml` on push to develop and PRs to main.
   `npm ci`, then lint, format check, typecheck, test, build. Node from
   `.nvmrc`, `permissions: contents: read`, actions pinned to commit SHAs.
6. Hook: PostToolUse on Edit/Write runs typecheck and lint, as planned in
   CLAUDE.md Tooling. Keep it fast; failures go back to Claude.
7. MCP TypeScript SDK: check whether v2 is stable or beta. Record the
   answer for step 03 under Gotchas; don't add the dependency yet.
8. Update CLAUDE.md Repo (real layout) and Commands; `.gitignore` for
   build output and coverage.

## Not in scope
- The MCP server and SDK dependency (step 03).
- Any retrieval, data package or NOTICE (plan 3). The
  `MIT AND CC-BY-SA-4.0` licence applies to data packages, and none
  exist yet.
- Site, npm publishing, release workflow, Dependabot.

## Done when
- ADR 0008 reviewed by me and set to Accepted.
- `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`,
  `npm test` and `npm run build` pass locally on Node 26.
- A planted type error and a planted lint error each make the hook and
  the matching script fail; then removed.
- CI run on develop is green (link in progress.md).
- CLAUDE.md Repo and Commands updated; roadmap 1.2 ticked.
