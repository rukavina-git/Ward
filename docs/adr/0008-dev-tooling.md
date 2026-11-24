# 8. Dev tooling

Date: 2026-11-21
Status: Accepted

## What is this
The tools that check the code while we write it: the package manager,
the TypeScript version, the linter, the formatter and the test runner.
ADR 0002 picked TypeScript on Node and left these open.

## Context
- One workspace with several packages (ADR 0002). Only `packages/core`
  exists so far.
- Ward is a security tool, so lint rules that need type information
  (a forgotten `await`, unsafe `any`) are worth the extra setup.
- Dependencies must be MIT, Apache 2.0, BSD or similar (CLAUDE.md).
- Every option below costs $0.

## Options

### Package manager
- **npm workspaces.** Ships with Node, and users will run Ward with
  `npx`. `.claude/settings.json` already allows `npm run`.
  - Con: slower installs, and less strict about undeclared dependencies.
- **pnpm.** Faster, and strict: a package can only import what it
  declares.
  - Con: one more tool to install, for a repo with one package today.

### TypeScript version
- **6.0.3 (the last 6.x).** Works with typescript-eslint.
  - Con: slower than 7.
- **7.0.2 (the new native compiler, much faster).**
  - Con: typescript-eslint 8.73 supports TypeScript `>=4.8.4 <6.1.0`, so
    type-aware lint would not work.

### Linter
- **ESLint 10 + typescript-eslint, `strictTypeChecked`.** The standard,
  with the largest set of rules that use type information.
  - Con: slower, and three packages to keep in step.
- **Biome.** One fast tool for lint and format, and works with
  TypeScript 7.
  - Con: fewer rules that understand types.

### Formatter
- **Prettier.** The standard, and it means no style debates.
  - Markdown is excluded. The docs are hand-wrapped prose, and Prettier
    would reformat them.
- **Formatting rules in the linter.** One tool fewer, but ESLint has
  moved formatting out of its core rules.

### Test runner
- **Vitest 5.** Runs TypeScript directly, fast watch mode, and later the
  same runner can test the website search in a browser.
- **`node:test`.** No dependency at all, since Node 26 strips types itself.
  - Con: weaker output and mocking, and no browser mode.

## Decision
npm workspaces, TypeScript 6.0.3, ESLint 10 with typescript-eslint
`strictTypeChecked`, Prettier (not on Markdown), Vitest 5. Node 26 (Active
LTS since 2026-10-28), pinned in `.nvmrc` and `engines`. Exact versions
in `package.json`, and the lockfile is committed.

TypeScript settings: ESM only, `module: nodenext`, `target: es2025`,
`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`.

**Licence exception, accepted by the owner:** Vitest pulls in 12 MPL-2.0
packages (lightningcss and its platform binaries, via vite). MPL-2.0 is
weak copyleft, which is outside the MIT/Apache/BSD rule. They are dev-only:
they're never in the npm package or the website's output, so publishing
isn't affected. Re-check if a shipped package ever depends on them.

## Consequences
- `npm run lint | format:check | typecheck | test | build` work the same
  locally, in the edit hook and in CI.
- Imports between files need the `.js` extension (a `nodenext` rule).
- Move to TypeScript 7 once typescript-eslint supports it. Check when
  plan 3 starts.
- If installs get slow or a package imports something it doesn't
  declare, revisit pnpm.

## Sources (checked 2026-11-21)
- Node release schedule: https://github.com/nodejs/Release/blob/main/schedule.json
- npm registry (versions and licences): typescript 6.0.3 Apache-2.0,
  eslint 10.15.0 MIT, @eslint/js 10.0.1 MIT, typescript-eslint 8.73.0 MIT,
  prettier 3.10.1 MIT, vitest 5.1.1 MIT
- Typed linting setup: https://typescript-eslint.io/getting-started/typed-linting
- TypeScript 6.0 defaults: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
